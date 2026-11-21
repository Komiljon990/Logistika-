import { describe, expect, it } from "vitest";
import { statement } from "@/lib/cash-core";

describe("hisob ko'chirmasi", () => {
  const mv = [
    { accountId: "a", day: "2026-10-30", amount: 500, at: 1 },
    { accountId: "a", day: "2026-11-05", amount: -200, at: 2 },
    { accountId: "a", day: "2026-11-02", amount: 1000, at: 5 },
    { accountId: "a", day: "2026-11-02", amount: -50, at: 3 },
    { accountId: "a", day: "2026-12-01", amount: 7, at: 9 },
  ];

  it("davr boshidagi qoldiq, har harakatdan keyingi qoldiq vaqt tartibida, oxirgi qoldiq", () => {
    const s = statement(100, mv, "2026-11-01", "2026-11-30");
    expect(s.opening).toBe(600);
    expect(s.rows.map((r) => [r.day, r.amount, r.balance])).toEqual([
      ["2026-11-02", -50, 550],
      ["2026-11-02", 1000, 1550],
      ["2026-11-05", -200, 1350],
    ]);
    expect([s.income, s.expense, s.closing]).toEqual([1000, 250, 1350]);
  });

  it("davrda harakat bo'lmasa — faqat qoldiq", () => {
    const s = statement(0, mv, "2027-01-01", "2027-01-31");
    expect(s.rows).toEqual([]);
    expect(s.opening).toBe(s.closing);
    expect(s.closing).toBe(1257);
  });
});
