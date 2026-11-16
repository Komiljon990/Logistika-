import { describe, expect, it } from "vitest";
import {
  parseCbu, crossRate, changePct, parseAmount, parseDay, lastDays, addDays, formatNumber, DEFAULT_CURRENCIES,
} from "@/lib/currency-core";
import { can } from "@/lib/roles";

describe("CBU parsing", () => {
  it("reads rates and divides by nominal", () => {
    const rows = parseCbu([
      { Ccy: "USD", Rate: "11964.27", Nominal: "1", CcyNm_UZ: "AQSH dollari" },
      { Ccy: "JPY", Rate: "7800.5", Nominal: "100", CcyNm_UZ: "Yaponiya iyenasi" },
      { Ccy: "US", Rate: "1" },
      { Ccy: "GBP", Rate: "abc" },
      { Ccy: "EUR", Rate: "-5" },
    ]);
    expect(rows).toEqual([
      { code: "USD", rate: 11964.27, name: "AQSH dollari" },
      { code: "JPY", rate: 78.005, name: "Yaponiya iyenasi" },
    ]);
  });
  it("tolerates garbage", () => {
    expect(parseCbu(null)).toEqual([]);
    expect(parseCbu({ error: true })).toEqual([]);
  });
});

describe("cross rates", () => {
  const rates = { USD: 12000, EUR: 13200, KZT: 24 };
  it("converts through so'm", () => {
    expect(crossRate(rates, "USD", "UZS")).toBe(12000);
    expect(crossRate(rates, "UZS", "USD")).toBeCloseTo(1 / 12000, 12);
    expect(crossRate(rates, "EUR", "USD")).toBeCloseTo(1.1, 10);
    expect(crossRate(rates, "USD", "KZT")).toBe(500);
    expect(crossRate(rates, "USD", "USD")).toBe(1);
  });
  it("returns null without a rate", () => {
    expect(crossRate(rates, "USD", "RUB")).toBeNull();
  });
  it("3500 USD paid in EUR at the CBU cross rate", () => {
    expect(3500 * crossRate(rates, "USD", "EUR")!).toBeCloseTo(3181.82, 2);
  });
});

describe("change and parsing", () => {
  it("computes change vs yesterday", () => {
    expect(changePct(11964.27, 11974.02)).toBeCloseTo(-0.0814, 3);
    expect(changePct(100, null)).toBeNull();
  });
  it("parses typed amounts with spaces and comma", () => {
    expect(parseAmount("11 964,27")).toBe(11964.27);
    expect(parseAmount("3500")).toBe(3500);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });
  it("formats with space thousands", () => {
    expect(formatNumber(11964.27)).toBe("11 964,27");
  });
});

describe("days", () => {
  it("validates dates", () => {
    expect(parseDay("2026-11-13")).toBe("2026-11-13");
    expect(parseDay("2026-02-30")).toBeNull();
    expect(parseDay("13.11.2026")).toBeNull();
  });
  it("builds the last 30 days ending today", () => {
    const d = lastDays("2026-11-13", 30);
    expect(d).toHaveLength(30);
    expect(d[0]).toBe("2026-10-15");
    expect(d[29]).toBe("2026-11-13");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("currency rules", () => {
  it("defaults: so'm, USD, EUR, RUB, KZT", () => {
    expect([...DEFAULT_CURRENCIES]).toEqual(["UZS", "USD", "EUR", "RUB", "KZT"]);
  });
  it("only the director manages currencies", () => {
    expect(can("DIRECTOR", "currency.manage")).toBe(true);
    for (const r of ["MANAGER", "ACCOUNTANT", "DEPUTY", "SUPER_ADMIN"] as const) expect(can(r, "currency.manage")).toBe(false);
  });
  it("vehicle delete: manager only (super admin sees no org data since 16.11.2026)", () => {
    expect(can("MANAGER", "vehicle.delete")).toBe(true);
    expect(can("SUPER_ADMIN", "vehicle.delete")).toBe(false);
    expect(can("DIRECTOR", "vehicle.delete")).toBe(false);
  });
});
