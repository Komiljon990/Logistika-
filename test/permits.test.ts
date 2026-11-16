import { describe, expect, it } from "vitest";
import { canDo, daysTo, nextStatus, parseNumbers } from "@/lib/permits-core";

describe("TIR / dazvol holatlari", () => {
  it("faqat tashkilotdagisi beriladi, faqat berilgani qaytariladi", () => {
    expect(canDo("ISSUE", "STOCK")).toBe(true);
    expect(canDo("ISSUE", "ISSUED")).toBe(false);
    expect(canDo("ISSUE", "USED")).toBe(false);
    expect(canDo("RETURN", "ISSUED")).toBe(true);
    expect(canDo("RETURN", "STOCK")).toBe(false);
  });
  it("qaytarilganda: ishlatilgan → topshirishga, ishlatilmagan → yana tashkilotda", () => {
    expect(nextStatus("RETURN", true)).toBe("USED");
    expect(nextStatus("RETURN", false)).toBe("STOCK");
  });
  it("yuqori tashkilotga: ishlatilgan yoki ishlatilmagan, lekin haydovchidagisi emas", () => {
    expect(canDo("SURRENDER", "USED")).toBe(true);
    expect(canDo("SURRENDER", "STOCK")).toBe(true);
    expect(canDo("SURRENDER", "ISSUED")).toBe(false);
    expect(canDo("LOST", "SURRENDERED")).toBe(false);
  });
});

describe("raqamlar ro'yxati", () => {
  it("vergul, qator, oraliq", () => {
    expect(parseNumbers("ab123, AB124\nAB125")).toEqual(["AB123", "AB124", "AB125"]);
    expect(parseNumbers("XA0098-XA0101")).toEqual(["XA0098", "XA0099", "XA0100", "XA0101"]);
    expect(parseNumbers("15-17")).toEqual(["15", "16", "17"]);
    expect(parseNumbers("E2E100-E2E102")).toEqual(["E2E100", "E2E101", "E2E102"]);
    expect(parseNumbers("AB/12-15")).toEqual(["AB/12", "AB/13", "AB/14", "AB/15"]);
    expect(parseNumbers("AB1 AB1")).toEqual(["AB1"]);
  });
  it("noto'g'ri yoki juda katta oraliq", () => {
    expect(parseNumbers("")).toBeNull();
    expect(parseNumbers("1-500")).toBeNull();
    expect(parseNumbers("<script>")).toBeNull();
  });
  it("muddat", () => {
    expect(daysTo("2026-11-20", "2026-11-16")).toBe(4);
    expect(daysTo(null, "2026-11-16")).toBeNull();
  });
});
