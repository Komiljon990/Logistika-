import { describe, expect, it } from "vitest";
import { lessorBalances, lessorStatement } from "@/lib/lessors-core";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("ijarachi bilan hisob-kitob", () => {
  it("har valyuta alohida: hisoblangan − to'langan = qarz", () => {
    const b = lessorBalances([
      { kind: "CHARGE", amount: 1000, currency: "USD" },
      { kind: "PAYMENT", amount: 400, currency: "USD" },
      { kind: "CHARGE", amount: 5_000_000, currency: "UZS" },
    ]);
    expect(b.USD).toEqual({ charged: 1000, paid: 400, debt: 600 });
    expect(b.UZS.debt).toBe(5_000_000);
  });

  it("ortiqcha to'lov — manfiy qarz (ijarachi oldindan olgan)", () => {
    expect(lessorBalances([{ kind: "PAYMENT", amount: 100, currency: "USD" }]).USD.debt).toBe(-100);
  });

  it("ko'chirma: sana tartibida qolgan qarz", () => {
    const rows = lessorStatement([
      { kind: "PAYMENT" as const, amount: 300, currency: "USD", date: d("2026-11-10"), createdAt: d("2026-11-10") },
      { kind: "CHARGE" as const, amount: 1000, currency: "USD", date: d("2026-11-01"), createdAt: d("2026-11-01") },
    ]);
    expect(rows.map((r) => [r.kind, r.debt])).toEqual([["CHARGE", 1000], ["PAYMENT", 700]]);
  });
});
