import { describe, expect, it } from "vitest";
import {
  accountKindFor, turnover, balance, parsePeriod, monthEnd, rateBaseFor, convertTransfer, cbuTransferRate,
  normalizeCard, formatCard, normalizeAccountNumber, normalizeMfo, accountLabel,
} from "@/lib/cash-core";
import { activityWhere, UNDOABLE } from "@/lib/activity-core";
import { can } from "@/lib/roles";

describe("tushum qaysi hisob turiga tushadi", () => {
  it("bank → bank, karta → karta, naqd ofis → kassa, haydovchidagi naqd → hali hech qayerga", () => {
    expect(accountKindFor("BANK", null)).toBe("BANK");
    expect(accountKindFor("CARD", null)).toBe("CARD");
    expect(accountKindFor("CASH", "OFFICE")).toBe("CASH");
    expect(accountKindFor("CASH", "DRIVER")).toBeNull();
  });
});

describe("aylanma va qoldiq", () => {
  const mv = [
    { accountId: "a", day: "2026-10-30", amount: 500 }, // davrdan oldin
    { accountId: "a", day: "2026-11-01", amount: 1000 },
    { accountId: "a", day: "2026-11-15", amount: -300.5 },
    { accountId: "a", day: "2026-11-30", amount: -200 },
    { accountId: "a", day: "2026-12-01", amount: 999 }, // davrdan keyin
  ];
  it("davr boshidagi qoldiq oldingi harakatlarni o'z ichiga oladi; chegaraviy kunlar davrga kiradi", () => {
    expect(turnover(100, mv, "2026-11-01", "2026-11-30")).toEqual({ opening: 600, income: 1000, expense: 500.5, closing: 1099.5 });
  });
  it("joriy qoldiq — boshlang'ich + barcha harakatlar", () => {
    expect(balance(100, mv)).toBe(2098.5);
    expect(balance(0, [])).toBe(0);
  });
  it("kasr summalar yaxlitlanadi (0.1 + 0.2 muammosi)", () => {
    expect(balance(0, [{ accountId: "a", day: "2026-11-01", amount: 0.1 }, { accountId: "a", day: "2026-11-01", amount: 0.2 }])).toBe(0.3);
  });
});

describe("hisobot davri", () => {
  it("bo'sh — joriy oy", () => {
    expect(parsePeriod("2026-11-14", {})).toEqual({ from: "2026-11-01", to: "2026-11-30", month: "2026-11" });
  });
  it("tanlangan oy; fevral va kabisa yili", () => {
    expect(parsePeriod("2026-11-14", { month: "2028-02" })).toEqual({ from: "2028-02-01", to: "2028-02-29", month: "2028-02" });
    expect(monthEnd("2026-02")).toBe("2026-02-28");
  });
  it("noto'g'ri oy — joriy oy", () => {
    expect(parsePeriod("2026-11-14", { month: "2026-13" }).month).toBe("2026-11");
    expect(parsePeriod("2026-11-14", { month: "abc" }).month).toBe("2026-11");
  });
  it("ixtiyoriy davr oydan ustun; teskari sanalar almashtiriladi; bittasi bo'lsa — bir kun", () => {
    expect(parsePeriod("2026-11-14", { month: "2026-10", from: "2026-11-10", to: "2026-11-01" })).toEqual({ from: "2026-11-01", to: "2026-11-10", month: null });
    expect(parsePeriod("2026-11-14", { from: "2026-11-05" })).toEqual({ from: "2026-11-05", to: "2026-11-05", month: null });
  });
  it("davr 2 yildan oshmaydi", () => {
    expect(parsePeriod("2026-11-14", { from: "2000-01-01", to: "2026-11-14" }).from).toBe("2024-11-13");
  });
});

describe("o'tkazma kursi", () => {
  const rates = { USD: 12650, EUR: 13700, RUB: 130 };
  it("qimmatroq valyuta asos bo'ladi", () => {
    expect(rateBaseFor(rates, "USD", "UZS")).toBe("USD");
    expect(rateBaseFor(rates, "UZS", "USD")).toBe("USD");
    expect(rateBaseFor(rates, "USD", "EUR")).toBe("EUR");
    expect(rateBaseFor(rates, "RUB", "USD")).toBe("USD");
  });
  it("kurs noma'lum bo'lsa — so'm bo'lmagan valyuta", () => {
    expect(rateBaseFor({}, "UZS", "KZT")).toBe("KZT");
    expect(rateBaseFor({}, "KZT", "UZS")).toBe("KZT");
  });
  it("tushadigan summa ikkala yo'nalishda", () => {
    expect(convertTransfer(1000, "USD", "UZS", 12650, "USD")).toBe(12_650_000);
    expect(convertTransfer(12_650_000, "UZS", "USD", 12650, "USD")).toBe(1000);
    expect(convertTransfer(100, "USD", "USD", 1, "USD")).toBe(100);
  });
  it("MB kursi asos bo'yicha", () => {
    expect(cbuTransferRate(rates, "UZS", "USD", "USD")).toBe(12650);
    expect(cbuTransferRate(rates, "USD", "EUR", "EUR")).toBeCloseTo(13700 / 12650, 8);
    expect(cbuTransferRate(rates, "KZT", "UZS", "KZT")).toBeNull();
  });
});

describe("rekvizitlar", () => {
  it("karta raqami", () => {
    expect(normalizeCard("8600 1234-5678 9012")).toBe("8600123456789012");
    expect(normalizeCard("8600 1234")).toBeNull();
    expect(normalizeCard("8600abcd56789012")).toBeNull();
    expect(formatCard("8600123456789012")).toBe("8600 1234 5678 9012");
  });
  it("hisob raqami 20 xona, MFO 5 xona", () => {
    expect(normalizeAccountNumber("2020 8000 1234 5678 9012")).toBe("20208000123456789012");
    expect(normalizeAccountNumber("2020800012345678901")).toBeNull();
    expect(normalizeMfo("00873")).toBe("00873");
    expect(normalizeMfo("873")).toBeNull();
  });
  it("hisob nomi ro'yxatda", () => {
    expect(accountLabel({ kind: "BANK", name: "Kapitalbank", accountNumber: "20208000123456789012", currency: "USD" })).toBe("Kapitalbank · …9012 · USD");
    expect(accountLabel({ kind: "CARD", name: "Humo", cardNumber: "9860123456781234", cardHolder: "Rahbar", currency: "UZS" })).toBe("Humo · *1234 (Rahbar) · UZS");
    expect(accountLabel({ kind: "CASH", name: "Asosiy kassa", currency: "UZS" })).toBe("Asosiy kassa · UZS");
  });
});

describe("kassa huquqlari", () => {
  it("hisobchi va menejer kiritadi; rahbar sozlaydi; vakil faqat ko'radi", () => {
    expect(can("ACCOUNTANT", "cash.edit")).toBe(true);
    expect(can("MANAGER", "cash.edit")).toBe(true);
    expect(can("DIRECTOR", "cash.edit")).toBe(false);
    expect(can("DEPUTY", "cash.edit")).toBe(false);
    expect(can("DIRECTOR", "cash.settings")).toBe(true);
    expect(can("MANAGER", "cash.settings")).toBe(false);
  });
});

describe("oxirgi amallar: kim nimani ko'radi", () => {
  it("rahbar — butun tashkilot, xohlasa faqat o'ziniki", () => {
    expect(activityWhere({ id: "d", role: "DIRECTOR", orgId: "o1" }, false)).toEqual({ orgId: "o1" });
    expect(activityWhere({ id: "d", role: "DIRECTOR", orgId: "o1" }, true)).toEqual({ actorId: "d", orgId: "o1" });
  });
  it("boshqalar — faqat o'ziniki (o'z tashkiloti ichida)", () => {
    expect(activityWhere({ id: "m", role: "MANAGER", orgId: "o1" }, false)).toEqual({ actorId: "m", orgId: "o1" });
    expect(activityWhere({ id: "a", role: "ACCOUNTANT", orgId: null }, false)).toEqual({ actorId: "a" });
  });
  it("faqat yaratish amallarini o'chirib bo'ladi", () => {
    expect(Object.keys(UNDOABLE).every((k) => k.endsWith(".create") || k === "document.renew")).toBe(true);
    expect("payment.cancel" in UNDOABLE).toBe(false);
  });
});
