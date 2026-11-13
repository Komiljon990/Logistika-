/** Valyuta hisob-kitoblari (bazasiz, testlanadi). Kurs = 1 birlik valyuta necha so'm. */

export const BASE = "UZS";

/** Yangi tashkilotda boshidan bo'ladigan valyutalar (13.11.2026 qarori). */
export const DEFAULT_CURRENCIES = ["UZS", "USD", "EUR", "RUB", "KZT"] as const;

export type RateMap = Record<string, number>;

export type CbuRow = { code: string; rate: number; name: string | null };

/** cbu.uz JSON javobini o'qiydi; nominal (masalan 10 yoki 100 birlik uchun kurs) hisobga olinadi. */
export function parseCbu(json: unknown): CbuRow[] {
  if (!Array.isArray(json)) return [];
  const out: CbuRow[] = [];
  for (const r of json) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const code = typeof o.Ccy === "string" ? o.Ccy.trim().toUpperCase() : "";
    const rate = Number(o.Rate);
    const nominal = Number(o.Nominal ?? 1) || 1;
    if (!/^[A-Z]{3}$/.test(code) || !Number.isFinite(rate) || rate <= 0) continue;
    const name = typeof o.CcyNm_UZ === "string" ? o.CcyNm_UZ : null;
    out.push({ code, rate: rate / nominal, name });
  }
  return out;
}

/** 1 `from` necha `to` bo'ladi (ikkalasi ham so'm orqali). Kurs yo'q bo'lsa null. */
export function crossRate(rates: RateMap, from: string, to: string): number | null {
  const a = from === BASE ? 1 : rates[from];
  const b = to === BASE ? 1 : rates[to];
  if (!a || !b) return null;
  return a / b;
}

/** Kecha → bugun o'zgarishi, foizda. */
export function changePct(today: number | null | undefined, yesterday: number | null | undefined): number | null {
  if (!today || !yesterday) return null;
  return ((today - yesterday) / yesterday) * 100;
}

/** Kursni ko'rsatish uchun: katta sonlar 2 xona, kichiklari ko'proq aniqlik bilan. */
export function rateDigits(value: number): number {
  if (value >= 100) return 2;
  if (value >= 1) return 4;
  return 6;
}

export function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    .format(value)
    .replace(/ /g, " ");
}

/** "11 964,27" yoki "11964.27" → 11964.27; bo'sh yoki noto'g'ri → null. */
export function parseAmount(s: string): number | null {
  const clean = s.replace(/[\s ]/g, "").replace(",", ".");
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

/** "YYYY-MM-DD" ni tekshiradi; noto'g'ri bo'lsa null. */
export function parseDay(v: string | undefined | null): string | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : v;
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Oxirgi `n` kun (bugun ham), eskisidan yangisiga. */
export function lastDays(today: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i - n + 1));
}
