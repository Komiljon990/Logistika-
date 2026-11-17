import { describe, expect, it } from "vitest";
import { buildXlsx, crc32, parseCell } from "../src/lib/xlsx";
import { CHARGE_TYPES, lessorBalances, monthOptions } from "../src/lib/lessors-core";

describe("Excel (xlsx)", () => {
  it("katakni son yoki matn deb ajratadi", () => {
    expect(parseCell("1 234 567,50")).toBe(1234567.5);
    expect(parseCell("1200")).toBe(1200);
    expect(parseCell("3 000 000 UZS")).toEqual({ n: 3000000, cur: "UZS" });
    expect(parseCell("-150.25 USD")).toEqual({ n: -150.25, cur: "USD" });
    expect(parseCell("01 AB 123")).toBe("01 AB 123");
    expect(parseCell("+998901234567")).toBe("+998901234567");
    expect(parseCell("007")).toBe("007");
    expect(parseCell("  ")).toBeNull();
    expect(parseCell("Toshkent → Moskva")).toBe("Toshkent → Moskva");
  });

  it("CRC32 to'g'ri", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("haqiqiy ZIP (PK) fayl, ichida varaq va valyuta formati", () => {
    const bytes = buildXlsx([["Nomi", "Summa"], ["Ali & Vali <MChJ>", { n: 1500, cur: "USD" }], ["Jami", 1500]], "Hisobot/1");
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("xl/worksheets/sheet1.xml");
    expect(text).toContain("Ali &amp; Vali &lt;MChJ&gt;");
    expect(text).toContain('&quot;USD&quot;');
    expect(text).toContain('<sheet name="Hisobot 1"');
    // Oxirgi yozuv — markaziy katalog oxiri (EOCD), 6 ta fayl
    const end = bytes.length - 22;
    expect(new DataView(bytes.buffer, bytes.byteOffset).getUint32(end, true)).toBe(0x06054b50);
    expect(new DataView(bytes.buffer, bytes.byteOffset).getUint16(end + 10, true)).toBe(6);
  });
});

describe("Haydovchilar hisob-kitobi", () => {
  it("hisob turlari: ijarachi va xodim haydovchi", () => {
    expect(CHARGE_TYPES.LESSOR).toEqual(["MEMBERSHIP", "TAX", "TIR", "DAZVOL", "OTHER"]);
    expect(CHARGE_TYPES.STAFF).toEqual(["TRIP", "BONUS", "OTHER"]);
  });

  it("oy tanlovi: keyingi 2 oy va oxirgi 12 oy, yil almashinuvi", () => {
    const m = monthOptions("2026-11-18");
    expect(m[0]).toBe("2027-01");
    expect(m[2]).toBe("2026-11");
    expect(m.at(-1)).toBe("2025-11");
    expect(m).toHaveLength(15);
  });

  it("qarz = hisoblangan − to'langan (valyuta bo'yicha)", () => {
    const b = lessorBalances([
      { kind: "CHARGE", amount: 500, currency: "USD" },
      { kind: "CHARGE", amount: 1_000_000, currency: "UZS" },
      { kind: "PAYMENT", amount: 200, currency: "USD" },
    ]);
    expect(b.USD).toEqual({ charged: 500, paid: 200, debt: 300 });
    expect(b.UZS.debt).toBe(1_000_000);
  });
});
