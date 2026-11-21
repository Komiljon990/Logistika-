/**
 * Telegram botda ovozli kiritish (21.11.2026) — sof qism (bazasiz, sinovlar shu yerni tekshiradi).
 *
 * Menejer botga ovozli xabar yuboradi → ovoz matnga o'giriladi (ai.ts) → AI matndan maydonlarni ajratadi
 * (mijoz, summa, valyuta, hisob, turkum, sana…) → bot qoralamani ko'rsatadi: «Tasdiqlash» / «Tuzatish» / «Bekor».
 * Dasturga faqat «Tasdiqlash» bosilganda yoziladi. Hozircha ikki tur: mijozdan to'lov va tashkilot xarajati.
 *
 * AI ro'yxatdagi raqamni (mijoz, hisob, turkum) qaytaradi — nomni emas: lotin/kirill farqi va xatolarni AI o'zi
 * moslaydi, biz esa raqam ro'yxatda borligini tekshiramiz. Topilmasa — o'xshash nomlar tugma qilib taklif qilinadi.
 */
import type { AccountKind } from "@prisma/client";

export type VoiceIntent = "payment" | "expense" | "unknown";
export type Method = AccountKind; // BANK | CASH | CARD

export type VoiceContext = {
  today: string; // YYYY-MM-DD (Toshkent)
  currencies: string[];
  clients: { id: string; name: string }[];
  /** Kassa yoqilgan bo'lsa — faol hisoblar; aks holda bo'sh. */
  accounts: { id: string; label: string; kind: Method; currency: string }[];
  /** Xarajat turkumlari: faqat tanlanadiganlari (bo'lim yoki bo'limi yo'q turkum), "Turkum › Bo'lim". */
  categories: { id: string; label: string }[];
  cashOn: boolean;
};

export type Option = { id: string; label: string };
export type PickField = "client" | "account" | "category" | "method" | "currency";

export type VoiceDraftData = {
  intent: VoiceIntent;
  clientId: string | null;
  clientName: string | null;
  clientText: string | null;
  amount: number | null;
  currency: string | null;
  method: Method | null;
  accountId: string | null;
  accountLabel: string | null;
  categoryId: string | null;
  categoryLabel: string | null;
  categoryText: string | null;
  tripNumber: number | null;
  tripId: string | null;
  date: string | null;
  note: string | null;
  /** Kassa yoqilgan va hisob ochilgan: to'lovda hisob majburiy (valyuta va usul hisobdan olinadi). */
  needsAccount: boolean;
  cashOn: boolean;
  /** Tugmalar: birinchi to'ldirilmagan maydon uchun variantlar. */
  pick: { field: PickField; options: Option[] } | null;
  /** Reys raqami aytilgan, lekin topilmadi. */
  tripMissing?: boolean;
};

export const METHOD_UZ: Record<Method, string> = { BANK: "Bank o'tkazmasi", CASH: "Naqd", CARD: "Karta" };
const METHODS: Method[] = ["BANK", "CASH", "CARD"];

// ---------- AI uchun so'rov ----------

/** AI javobining shakli (Cloudflare Workers AI JSON rejimi uchun). */
export const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    intent: { type: "string", enum: ["payment", "expense", "unknown"] },
    client: { type: ["integer", "null"] },
    client_text: { type: ["string", "null"] },
    amount: { type: ["number", "null"] },
    currency: { type: ["string", "null"] },
    method: { type: ["string", "null"], enum: ["BANK", "CASH", "CARD", null] },
    account: { type: ["integer", "null"] },
    category: { type: ["integer", "null"] },
    category_text: { type: ["string", "null"] },
    trip: { type: ["integer", "null"] },
    date: { type: ["string", "null"] },
    note: { type: ["string", "null"] },
  },
  required: ["intent"],
} as const;

function list(items: string[], max: number): string {
  if (!items.length) return "(bo'sh)";
  const shown = items.slice(0, max).map((s, i) => `${i + 1}. ${s}`);
  if (items.length > max) shown.push(`… (yana ${items.length - max} ta)`);
  return shown.join("\n");
}

/**
 * AI uchun ko'rsatma. `previous` — tuzatishda: avvalgi qoralama (AI faqat aytilgan maydonni o'zgartiradi).
 * Ro'yxatlar uzun bo'lsa qisqartiriladi (so'rov hajmi va bepul limit uchun).
 */
export function buildPrompt(ctx: VoiceContext, transcript: string, previous?: VoiceDraftData | null): { system: string; user: string } {
  const system = [
    "Sen O'zbekistondagi yuk tashish (logistika) firmasi dasturining yordamchisisan.",
    "Menejer ovozli xabar yuboradi (o'zbek yoki rus tilida; matn ovozdan avtomatik olingani uchun xatolar bo'lishi mumkin).",
    "Vazifang: matndan quyidagi amallardan birini aniqlash va maydonlarni JSON qilib qaytarish. Faqat JSON, boshqa hech narsa yozma.",
    "",
    "intent:",
    '- "payment" — mijoz (yuk egasi) bizga pul to\'ladi / pul tushdi / perechisleniye keldi.',
    '- "expense" — firma pul sarfladi: yoqilg\'i, ta\'mir, yo\'l haqi, ish haqi, ijara va h.k.',
    '- "unknown" — boshqa narsa yoki tushunarsiz.',
    "",
    "Maydonlar:",
    "- client: mijozlar ro'yxatidagi RAQAM (payment uchun). Nom lotin/kirillda yoki biroz boshqacha aytilgan bo'lishi mumkin — eng mosini tanla. Ishonching bo'lmasa null.",
    "- client_text: matnda aytilgan mijoz nomi (aynan).",
    "- amount: son. «besh ming» = 5000, «bir yarim million» = 1500000, «2.5 mln» = 2500000, «tysyacha dollarov» = 1000.",
    `- currency: ${ctx.currencies.join(", ")} dan biri. so'm/sum = UZS, dollar = USD, yevro = EUR, rubl = RUB. Aytilmasa null.`,
    "- method: BANK (bank, perechisleniye, o'tkazma, hisob raqamga), CASH (naqd, nal, naqdina), CARD (karta, plastik). Aytilmasa null.",
    "- account: hisoblar ro'yxatidagi RAQAM, faqat aniq aytilgan bo'lsa (masalan «Kapitalbankka», «kassaga»). Aks holda null.",
    "- category: xarajat turkumlari ro'yxatidagi RAQAM (expense uchun), eng mosi. Ishonching bo'lmasa null.",
    "- category_text: xarajat nima uchunligi (aynan).",
    "- trip: reys raqami (son), aytilgan bo'lsa (masalan «42-reys», «TSH-0042»).",
    `- date: YYYY-MM-DD. Bugun ${ctx.today}. «kecha», «o'tgan dushanba» kabi so'zlardan hisobla. Aytilmasa null.`,
    "- note: qo'shimcha izoh (qisqa), bo'lmasa null.",
    "Aytilmagan narsani o'ylab topma — null qo'y.",
  ].join("\n");
  const parts = [
    `Mijozlar:\n${list(ctx.clients.map((c) => c.name), 300)}`,
    `Hisoblar:\n${list(ctx.accounts.map((a) => `${a.label} (${METHOD_UZ[a.kind]})`), 40)}`,
    `Xarajat turkumlari:\n${list(ctx.categories.map((c) => c.label), 120)}`,
  ];
  if (previous) {
    parts.push(
      "Avvalgi qoralama (menejer uni tuzatmoqda — faqat tuzatishda aytilgan maydonlarni o'zgartir, qolganini saqla):",
      JSON.stringify(previousForPrompt(previous, ctx)),
      `Tuzatish: «${transcript}»`,
    );
  } else {
    parts.push(`Menejer xabari: «${transcript}»`);
  }
  return { system, user: parts.join("\n\n") };
}

function indexOf<T extends { id: string }>(arr: T[], id: string | null): number | null {
  const i = id ? arr.findIndex((x) => x.id === id) : -1;
  return i >= 0 ? i + 1 : null;
}

function previousForPrompt(d: VoiceDraftData, ctx: VoiceContext) {
  return {
    intent: d.intent, client: indexOf(ctx.clients, d.clientId), client_text: d.clientText, amount: d.amount, currency: d.currency, method: d.method,
    account: indexOf(ctx.accounts, d.accountId), category: indexOf(ctx.categories, d.categoryId), category_text: d.categoryText,
    trip: d.tripNumber, date: d.date, note: d.note,
  };
}

/** AI javobi: obyekt yoki matn ichidagi birinchi {...}. */
export function parseLlmJson(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== "string") return null;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const v = JSON.parse(raw.slice(start, end + 1));
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

// ---------- O'xshash nomlarni topish ----------

const CYR: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "s", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "", э: "e", ю: "yu",
  я: "ya", ў: "o", қ: "q", ғ: "g", ҳ: "h",
};

/** Solishtirish uchun: kichik harf, kirill → lotin, belgilar va «MChJ/OOO» kabi so'zlarsiz. */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[а-яёўқғҳ]/g, (ch) => CYR[ch] ?? ch)
    .replace(/[‘’ʻʼ`'"«»]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(ooo|mchj|llc|xk|ok|ip|chp|ltd|firma|kompaniya|mijoz)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bigrams(s: string): string[] {
  const t = s.replace(/ /g, "");
  const out: string[] = [];
  for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
  return out;
}

/** 0..1 — Dice koeffitsienti (harf juftliklari) + biri ikkinchisining ichida bo'lsa ustunlik. */
export function similarity(a: string, b: string): number {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.length >= 3 && y.length >= 3 && (x.includes(y) || y.includes(x))) return 0.9;
  const bx = bigrams(x);
  const by = bigrams(y);
  if (!bx.length || !by.length) return 0;
  const pool = [...by];
  let hit = 0;
  for (const g of bx) {
    const i = pool.indexOf(g);
    if (i >= 0) { hit++; pool.splice(i, 1); }
  }
  return (2 * hit) / (bx.length + by.length);
}

/** Matnga eng o'xshash variantlar (eng ko'pi `max` ta, chegaradan past bo'lsa — kirmaydi). */
export function closest(text: string | null, items: Option[], max = 4, min = 0.35): Option[] {
  if (!text) return [];
  return items
    .map((o) => ({ o, s: similarity(text, o.label) }))
    .filter((x) => x.s >= min)
    .sort((a, b) => b.s - a.s)
    .slice(0, max)
    .map((x) => x.o);
}

// ---------- AI javobini qoralamaga aylantirish ----------

function str(v: unknown, max = 200): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[\s ]/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pickIndex<T>(arr: T[], v: unknown): T | null {
  const n = num(v);
  return n !== null && Number.isInteger(n) && n >= 1 && n <= arr.length ? arr[n - 1] : null;
}

function validDate(v: unknown, today: string): string | null {
  const s = str(v, 10);
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return null;
  return s;
}

/**
 * AI javobidan qoralama. Hamma narsa qayta tekshiriladi: raqam ro'yxatda bo'lishi, valyuta tashkilotniki bo'lishi,
 * hisob valyutasi aytilgan valyutaga mos kelishi. Reys raqami bo'yicha qidiruv — bazali qismda (tripId).
 */
export function resolveDraft(raw: Record<string, unknown>, ctx: VoiceContext): VoiceDraftData {
  const intent: VoiceIntent = raw.intent === "payment" || raw.intent === "expense" ? raw.intent : "unknown";
  const client = pickIndex(ctx.clients, raw.client);
  const category = pickIndex(ctx.categories, raw.category);
  let account = pickIndex(ctx.accounts, raw.account);
  const amountRaw = num(raw.amount);
  const amount = amountRaw !== null && amountRaw > 0 && amountRaw <= 1e13 ? Math.round(amountRaw * 100) / 100 : null;
  const curRaw = str(raw.currency, 10)?.toUpperCase() ?? null;
  let currency = curRaw && ctx.currencies.includes(curRaw) ? curRaw : null;
  const method = METHODS.includes(raw.method as Method) ? (raw.method as Method) : null;
  const tripN = num(raw.trip);
  const needsAccount = ctx.cashOn && ctx.accounts.length > 0;

  // Hisob aytilgan valyutaga mos kelmasa — hisob tanlanmaydi (tugma bilan so'raladi).
  if (account && currency && account.currency !== currency) account = null;
  if (needsAccount && !account && intent !== "unknown") {
    const fit = ctx.accounts.filter((a) => (!currency || a.currency === currency) && (intent !== "payment" || !method || a.kind === method));
    if (fit.length === 1) account = fit[0];
  }
  if (account) currency = account.currency;

  const d: VoiceDraftData = {
    intent,
    clientId: intent === "payment" ? client?.id ?? null : null,
    clientName: intent === "payment" ? client?.name ?? null : null,
    clientText: str(raw.client_text, 120),
    amount,
    currency,
    method: account ? account.kind : method,
    accountId: account?.id ?? null,
    accountLabel: account?.label ?? null,
    categoryId: intent === "expense" ? category?.id ?? null : null,
    categoryLabel: intent === "expense" ? category?.label ?? null : null,
    categoryText: str(raw.category_text, 120),
    tripNumber: tripN !== null && Number.isInteger(tripN) && tripN > 0 && tripN < 1e7 ? tripN : null,
    tripId: null,
    date: validDate(raw.date, ctx.today) ?? ctx.today,
    note: str(raw.note, 300),
    needsAccount,
    cashOn: ctx.cashOn,
    pick: null,
  };
  d.pick = nextPick(d, ctx);
  return d;
}

/** To'ldirilmagan maydonlar (tasdiqlash tugmasi faqat ular bo'sh bo'lsa chiqadi). */
export function missingFields(d: VoiceDraftData, today: string): string[] {
  const out: string[] = [];
  if (d.intent === "unknown") return ["intent"];
  if (d.intent === "expense" && !d.needsAccount) return ["cash"];
  if (d.intent === "payment" && !d.clientId) out.push("client");
  if (d.amount === null) out.push("amount");
  if (d.needsAccount) {
    if (!d.accountId) out.push("account");
  } else {
    if (!d.currency) out.push("currency");
    if (!d.method) out.push("method");
  }
  if (d.intent === "expense" && !d.categoryId) out.push("category");
  if (!d.date || d.date > today) out.push("date");
  if (d.tripMissing) out.push("trip");
  return out;
}

/** Birinchi to'ldirilmagan maydon uchun tugma variantlari. */
export function nextPick(d: VoiceDraftData, ctx: VoiceContext): VoiceDraftData["pick"] {
  if (d.intent === "unknown" || (d.intent === "expense" && !d.needsAccount)) return null;
  if (d.intent === "payment" && !d.clientId) {
    const options = closest(d.clientText, ctx.clients.map((c) => ({ id: c.id, label: c.name })));
    return options.length ? { field: "client", options } : null;
  }
  if (d.needsAccount && !d.accountId) {
    let fit = ctx.accounts.filter((a) => (!d.currency || a.currency === d.currency) && (d.intent !== "payment" || !d.method || a.kind === d.method));
    if (!fit.length) fit = ctx.accounts.filter((a) => !d.currency || a.currency === d.currency);
    if (!fit.length) fit = ctx.accounts;
    return { field: "account", options: fit.slice(0, 8).map((a) => ({ id: a.id, label: a.label })) };
  }
  if (!d.needsAccount && !d.currency) return { field: "currency", options: ctx.currencies.slice(0, 8).map((c) => ({ id: c, label: c })) };
  if (!d.needsAccount && !d.method) return { field: "method", options: METHODS.map((m) => ({ id: m, label: METHOD_UZ[m] })) };
  if (d.intent === "expense" && !d.categoryId) {
    const options = closest(d.categoryText, ctx.categories, 6, 0.3);
    return options.length ? { field: "category", options } : null;
  }
  return null;
}

/** Tugma bosildi: tanlangan variantni qoralamaga qo'yadi. Variant ro'yxatda bo'lmasa — null. */
export function applyPick(d: VoiceDraftData, ctx: VoiceContext, field: PickField, index: number): VoiceDraftData | null {
  if (!d.pick || d.pick.field !== field) return null;
  const opt = d.pick.options[index];
  if (!opt) return null;
  const next: VoiceDraftData = { ...d };
  if (field === "client") {
    const c = ctx.clients.find((x) => x.id === opt.id);
    if (!c) return null;
    next.clientId = c.id;
    next.clientName = c.name;
  } else if (field === "account") {
    const a = ctx.accounts.find((x) => x.id === opt.id);
    if (!a) return null;
    next.accountId = a.id;
    next.accountLabel = a.label;
    next.currency = a.currency;
    next.method = a.kind;
  } else if (field === "category") {
    const c = ctx.categories.find((x) => x.id === opt.id);
    if (!c) return null;
    next.categoryId = c.id;
    next.categoryLabel = c.label;
  } else if (field === "currency") {
    if (!ctx.currencies.includes(opt.id)) return null;
    next.currency = opt.id;
  } else {
    if (!METHODS.includes(opt.id as Method)) return null;
    next.method = opt.id as Method;
  }
  next.pick = nextPick(next, ctx);
  return next;
}

// ---------- Kartochka matni ----------

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function money(n: number): string {
  const [i, f] = (Math.round(n * 100) / 100).toFixed(2).split(".");
  const int = i.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return f === "00" ? int : `${int},${f}`;
}

function ddmmyyyy(s: string): string {
  return `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`;
}

const MISSING_UZ: Record<string, string> = {
  client: "mijoz", amount: "summa", account: "hisob (qayerga)", currency: "valyuta", method: "to'lov turi", category: "xarajat turkumi",
  date: "sana (kelajakdagi sana bo'lmaydi)", trip: "reys (bunday raqamli reys topilmadi)",
};

const PICK_UZ: Record<PickField, string> = {
  client: "Qaysi mijoz? Tanlang:", account: "Qaysi hisob? Tanlang:", category: "Qaysi turkum? Tanlang:", method: "To'lov turi? Tanlang:", currency: "Valyuta? Tanlang:",
};

/** Qoralama kartochkasi (HTML). */
export function draftCard(d: VoiceDraftData, transcript: string, today: string, orgName?: string | null): string {
  const lines = [`🎙 <i>«${escHtml(transcript.length > 600 ? `${transcript.slice(0, 600)}…` : transcript)}»</i>`, ""];
  const val = (v: string | null, fallback = "❓") => (v ? `<b>${escHtml(v)}</b>` : fallback);
  if (d.intent === "unknown") {
    lines.push("🤔 Tushunmadim: bu mijoz to'lovimi yoki xarajatmi?", "Qaytadan aniqroq ayting, masalan:", "• «Alfa Trans 5000 dollar to'ladi, bankka»", "• «42-reys uchun 300 dollar yoqilg'i, naqd kassadan»");
    return lines.join("\n");
  }
  if (d.intent === "expense" && !d.needsAccount) {
    lines.push("💸 Xarajat", "", "Kassa bo'limi yoqilmagan yoki hisob ochilmagan — xarajatni avval saytda «Kassa» bo'limida sozlang.");
    return lines.join("\n");
  }
  const amount = d.amount !== null ? `${money(d.amount)}${d.currency ? ` ${d.currency}` : ""}` : null;
  if (d.intent === "payment") {
    lines.push("💵 <b>Mijozdan to'lov</b>", "");
    lines.push(`👥 Mijoz: ${val(d.clientName, d.clientText ? `❓ «${escHtml(d.clientText)}» topilmadi` : "❓")}`);
  } else {
    lines.push("💸 <b>Xarajat</b>", "");
    lines.push(`🏷 Turkum: ${val(d.categoryLabel, d.categoryText ? `❓ «${escHtml(d.categoryText)}»` : "❓")}`);
  }
  lines.push(`💰 Summa: ${val(amount)}`);
  if (d.needsAccount) lines.push(`🏦 ${d.intent === "payment" ? "Qayerga" : "Qayerdan"}: ${val(d.accountLabel)}`);
  else lines.push(`💳 To'lov turi: ${val(d.method ? METHOD_UZ[d.method] : null)}`);
  if (d.intent === "expense" && (d.tripNumber || d.tripMissing)) lines.push(`🚚 Reys: ${d.tripId ? `<b>TSH-${String(d.tripNumber).padStart(4, "0")}</b>` : `❓ ${d.tripNumber} topilmadi`}`);
  lines.push(`📅 Sana: ${val(d.date ? ddmmyyyy(d.date) : null)}`);
  if (d.note) lines.push(`📝 Izoh: ${escHtml(d.note)}`);
  if (orgName) lines.push(`🏢 ${escHtml(orgName)}`);
  const miss = missingFields(d, today);
  lines.push("");
  if (miss.length) {
    lines.push(`⚠️ Yetishmayapti: ${miss.map((m) => MISSING_UZ[m] ?? m).join(", ")}.`);
    lines.push(d.pick ? PICK_UZ[d.pick.field] : "«✏️ Tuzatish»ni bosib, ovoz yoki matn bilan ayting.");
  } else {
    lines.push("Hammasi to'g'rimi? Tasdiqlasangiz, dasturga yoziladi.");
  }
  return lines.join("\n");
}
