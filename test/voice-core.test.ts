// Ovozli kiritish (21.11.2026) — sof qism: AI javobini tekshirish, o'xshash nomlar, kartochka.
import { describe, expect, it } from "vitest";
import { applyPick, buildPrompt, closest, draftCard, missingFields, normalizeName, parseLlmJson, resolveDraft, similarity, type VoiceContext } from "@/lib/voice-core";

const ctx: VoiceContext = {
  today: "2026-11-21",
  currencies: ["UZS", "USD", "EUR", "RUB"],
  clients: [{ id: "c1", name: "Alfa Trans MChJ" }, { id: "c2", name: "Beta Logistik" }, { id: "c3", name: "Альфа Груп" }],
  accounts: [
    { id: "a1", label: "Kapitalbank · …1234 · USD", kind: "BANK", currency: "USD" },
    { id: "a2", label: "Kassa · UZS", kind: "CASH", currency: "UZS" },
    { id: "a3", label: "Kassa dollar · USD", kind: "CASH", currency: "USD" },
  ],
  categories: [{ id: "k1", label: "Yoqilg'i" }, { id: "k2", label: "Ta'mir › Shina" }],
  cashOn: true,
};

describe("o'xshash nomlar", () => {
  it("kirill va lotin, MChJ kabi so'zlarsiz", () => {
    expect(normalizeName("«Альфа Транс» ООО")).toBe("alfa trans");
    expect(similarity("Альфа Транс", "Alfa Trans MChJ")).toBeGreaterThan(0.85);
    expect(similarity("alfa", "Beta Logistik")).toBeLessThan(0.35);
  });
  it("eng o'xshashlari tartib bilan", () => {
    const opts = ctx.clients.map((c) => ({ id: c.id, label: c.name }));
    expect(closest("Alfa", opts).map((o) => o.id)).toEqual(["c1", "c3"]);
    expect(closest(null, opts)).toEqual([]);
  });
});

describe("AI javobini qoralamaga aylantirish", () => {
  it("ro'yxat raqamlari id ga aylanadi, hisob valyutasi va turi hisobdan olinadi", () => {
    const d = resolveDraft({ intent: "payment", client: 1, amount: "5 000", currency: "usd", account: 1, date: "2026-11-20" }, ctx);
    expect(d).toMatchObject({ intent: "payment", clientId: "c1", amount: 5000, currency: "USD", accountId: "a1", method: "BANK", date: "2026-11-20" });
    expect(missingFields(d, ctx.today)).toEqual([]);
    expect(d.pick).toBeNull();
  });
  it("ro'yxatda yo'q raqam va boshqa tashkilot valyutasi qabul qilinmaydi", () => {
    const d = resolveDraft({ intent: "payment", client: 99, client_text: "Alfa", amount: 100, currency: "KZT" }, ctx);
    expect(d.clientId).toBeNull();
    expect(d.currency).toBeNull();
    expect(d.pick?.field).toBe("client");
    expect(d.pick?.options.map((o) => o.id)).toEqual(["c1", "c3"]);
  });
  it("hisob valyutasi aytilgan valyutaga mos kelmasa — hisob tanlanmaydi, mos hisoblar taklif qilinadi", () => {
    const d = resolveDraft({ intent: "payment", client: 2, amount: 100, currency: "USD", account: 2 }, ctx);
    expect(d.accountId).toBeNull();
    expect(d.pick).toEqual({ field: "account", options: [{ id: "a1", label: ctx.accounts[0].label }, { id: "a3", label: ctx.accounts[2].label }] });
  });
  it("valyuta va tur bo'yicha bitta hisob qolsa — o'zi tanlanadi", () => {
    const d = resolveDraft({ intent: "payment", client: 2, amount: 100, currency: "USD", method: "CASH" }, ctx);
    expect(d.accountId).toBe("a3");
  });
  it("sana: aytilmasa bugun, noto'g'ri bo'lsa bugun, kelajakdagi — yetishmaydi", () => {
    expect(resolveDraft({ intent: "payment" }, ctx).date).toBe("2026-11-21");
    expect(resolveDraft({ intent: "payment", date: "2026-02-30" }, ctx).date).toBe("2026-11-21");
    const f = resolveDraft({ intent: "payment", client: 1, amount: 1, account: 1, date: "2026-12-01" }, ctx);
    expect(missingFields(f, ctx.today)).toEqual(["date"]);
  });
  it("kassasiz tashkilot: to'lovda valyuta va to'lov turi so'raladi; xarajat bo'lmaydi", () => {
    const noCash = { ...ctx, cashOn: false, accounts: [], categories: [] };
    const p = resolveDraft({ intent: "payment", client: 1, amount: 10 }, noCash);
    expect(missingFields(p, ctx.today)).toEqual(["currency", "method"]);
    expect(p.pick?.field).toBe("currency");
    const p2 = applyPick(p, noCash, "currency", 1)!;
    expect(p2.currency).toBe("USD");
    expect(p2.pick?.field).toBe("method");
    const p3 = applyPick(p2, noCash, "method", 1)!;
    expect(p3.method).toBe("CASH");
    expect(missingFields(p3, ctx.today)).toEqual([]);
    expect(missingFields(resolveDraft({ intent: "expense", amount: 5 }, noCash), ctx.today)).toEqual(["cash"]);
  });
  it("xarajat: turkum topilmasa o'xshashlari taklif qilinadi; noto'g'ri tugma qabul qilinmaydi", () => {
    const d = resolveDraft({ intent: "expense", amount: 300, account: 3, category_text: "yoqilgi" }, ctx);
    expect(d.pick?.field).toBe("category");
    expect(applyPick(d, ctx, "account", 0)).toBeNull();
    expect(applyPick(d, ctx, "category", 5)).toBeNull();
    const ok = applyPick(d, ctx, "category", 0)!;
    expect(ok.categoryId).toBe("k1");
    expect(missingFields(ok, ctx.today)).toEqual([]);
  });
  it("noma'lum niyat", () => {
    const d = resolveDraft({ intent: "salom" }, ctx);
    expect(missingFields(d, ctx.today)).toEqual(["intent"]);
    expect(draftCard(d, "salom", ctx.today)).toContain("Tushunmadim");
  });
});

describe("AI javobi va so'rov", () => {
  it("matn ichidagi JSON ham o'qiladi", () => {
    expect(parseLlmJson('Mana: {"intent":"payment","amount":5} tayyor')).toEqual({ intent: "payment", amount: 5 });
    expect(parseLlmJson({ intent: "expense" })).toEqual({ intent: "expense" });
    expect(parseLlmJson("yo'q")).toBeNull();
    expect(parseLlmJson("[1,2]")).toBeNull();
  });
  it("so'rovda ro'yxatlar raqamlangan, tuzatishda avvalgi qoralama bor", () => {
    const p = buildPrompt(ctx, "Alfa 5000 dollar to'ladi");
    expect(p.user).toContain("1. Alfa Trans MChJ");
    expect(p.user).toContain("2. Ta'mir › Shina");
    expect(p.system).toContain("Bugun 2026-11-21");
    const d = resolveDraft({ intent: "payment", client: 1, amount: 5000, account: 1 }, ctx);
    const e = buildPrompt(ctx, "summa 4500", d);
    expect(e.user).toContain('"client":1');
    expect(e.user).toContain("Tuzatish: «summa 4500»");
  });
  it("kartochka: maydonlar, HTML xavfsiz", () => {
    const d = resolveDraft({ intent: "payment", client: 1, amount: 1234567.5, account: 1, note: "<b>avans</b>" }, ctx);
    const card = draftCard(d, "a < b", ctx.today, "Firma");
    expect(card).toContain("Alfa Trans MChJ");
    expect(card).toContain("1 234 567,50 USD");
    expect(card).toContain("&lt;b&gt;avans");
    expect(card).toContain("«a &lt; b»");
    expect(card).toContain("🏢 Firma");
    expect(card).toContain("Hammasi to'g'rimi?");
  });
});
