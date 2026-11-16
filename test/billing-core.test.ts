import { describe, expect, it } from "vitest";
import { addMonths, discountFor, fitsPlan, periodEnd, planFor, quote, remainingMonths, upgradeQuote } from "@/lib/billing-core";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("obuna narxi", () => {
  it("yillik = 10 oylik narxi, 25% chegirma 2027 oxirigacha", () => {
    expect(quote("T10", "YEARLY", d("2026-11-17"))).toEqual({ baseAmount: 1_000_000, discountPercent: 25, amount: 750_000 });
    expect(quote("T20", "MONTHLY", d("2027-12-31"))).toEqual({ baseAmount: 200_000, discountPercent: 25, amount: 150_000 });
    expect(quote("T20P", "MONTHLY", d("2028-01-01"))).toEqual({ baseAmount: 300_000, discountPercent: 0, amount: 300_000 });
    expect(discountFor(d("2028-01-01"))).toBe(0);
  });

  it("davr: yillik 12 oy, oylik 1 oy (oxirgi kun ham kiradi)", () => {
    expect(periodEnd(d("2026-11-17"), "YEARLY").toISOString().slice(0, 10)).toBe("2027-11-16");
    expect(periodEnd(d("2026-01-31"), "MONTHLY").toISOString().slice(0, 10)).toBe("2026-02-27");
    expect(addMonths(d("2027-01-31"), 1).toISOString().slice(0, 10)).toBe("2027-02-28");
  });
});

describe("tarifni oshirish", () => {
  const cur = { plan: "T10" as const, period: "YEARLY" as const, start: d("2028-01-01"), end: d("2028-12-31") };

  it("texnik shart misoli: 9 oy qolgan, farq 1 000 000 → 750 000", () => {
    const q = upgradeQuote(cur, "T20", d("2028-04-01"));
    expect(q).toMatchObject({ ok: true, months: 9, baseAmount: 750_000, discountPercent: 0, amount: 750_000 });
  });

  it("boshlangan oy to'liq hisoblanadi; chegirma muddatida 25% kam", () => {
    const c = { ...cur, start: d("2027-01-01"), end: d("2027-12-31") };
    expect(remainingMonths(d("2027-03-15"), c.end)).toBe(10);
    expect(upgradeQuote(c, "T20P", d("2027-03-15"))).toMatchObject({ ok: true, months: 10, baseAmount: 1_666_700, amount: 1_250_025 });
  });

  it("pastroq tarifga obuna orasida o'tilmaydi; muddat tugagan bo'lsa ham", () => {
    expect(upgradeQuote(cur, "T10", d("2028-04-01"))).toEqual({ ok: false, error: "notHigher" });
    expect(upgradeQuote(cur, "T20", d("2029-01-01"))).toEqual({ ok: false, error: "expired" });
  });

  it("oylikda qolgan kunlar ulushi", () => {
    const m = { plan: "T10" as const, period: "MONTHLY" as const, start: d("2028-04-01"), end: d("2028-04-30") };
    expect(upgradeQuote(m, "T20", d("2028-04-16"))).toMatchObject({ ok: true, days: 15, baseAmount: 50_000 });
  });
});

describe("tarif chegarasi", () => {
  it("faol tyagachlar soni", () => {
    expect(fitsPlan("T10", 10)).toBe(true);
    expect(fitsPlan("T10", 11)).toBe(false);
    expect(fitsPlan("T20P", 500)).toBe(true);
    expect(fitsPlan(null, 500)).toBe(true);
    expect(planFor(0)).toBe("T10");
    expect(planFor(15)).toBe("T20");
    expect(planFor(21)).toBe("T20P");
  });
});
