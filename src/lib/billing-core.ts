/**
 * Obuna qoidalari (17.11.2026, narxlar 21.11.2026 da yangilangan; sof — bazasiz):
 * - tarif faol tyagachlar soni bo'yicha: 10 tagacha, 20 tagacha, 20 dan ko'p;
 * - oylik yoki yillik; yillik = 10 oy narxi, 12 oy foydalaniladi;
 * - 31.12.2027 gacha (shu kun ham) yaratilgan to'lov hisoblariga 25% chegirma;
 * - 31.12.2026 gacha (shu kun ham) bepul sinov davri (21.11.2026 qarori): cheklovsiz transport, to'lov hisobi
 *   chiqmaydi; shu davrda tasdiqlangan arizaning obunasi sinov oxirigacha, keyin pullik tarif (uzaytirish orqali);
 * - obuna orasida transport kamaysa pul qaytarilmaydi; tarif oshirilsa joriy davr oxirigacha qolgan qism uchun
 *   farq to'lanadi (yillikda qolgan oylar × farq / 12; oylikda qolgan kunlar ulushi).
 */
export type BillingPeriod = "MONTHLY" | "YEARLY";

export const PLANS = [
  { id: "T10", limit: 10, monthly: 200_000, yearly: 2_000_000 },
  { id: "T20", limit: 20, monthly: 300_000, yearly: 3_000_000 },
  { id: "T20P", limit: null, monthly: 400_000, yearly: 4_000_000 },
] as const;

export type PlanId = (typeof PLANS)[number]["id"];

export const PROMO_PERCENT = 25;
/** Chegirma oxirgi kuni (Toshkent sanasi, YYYY-MM-DD). */
export const PROMO_UNTIL = "2027-12-31";

/** Bepul sinov davrining oxirgi kuni (Toshkent sanasi, YYYY-MM-DD). */
export const TRIAL_UNTIL = "2026-12-31";

export function inTrial(today: Date): boolean {
  return ymd(today) <= TRIAL_UNTIL;
}

/** Sinov oxirgi kuni (UTC yarim tun). */
export function trialEnd(): Date {
  return new Date(`${TRIAL_UNTIL}T00:00:00Z`);
}

/** "YYYY-MM-DD" → "DD.MM.YYYY". */
export function dmy(s: string): string {
  return s.split("-").reverse().join(".");
}

export function isPlan(v: unknown): v is PlanId {
  return PLANS.some((p) => p.id === v);
}

export function isPeriod(v: unknown): v is BillingPeriod {
  return v === "MONTHLY" || v === "YEARLY";
}

export function plan(id: PlanId) {
  return PLANS.find((p) => p.id === id)!;
}

/** Tarif chegarasi: null — cheklanmagan. */
export function planLimit(id: string | null | undefined): number | null {
  return isPlan(id) ? plan(id).limit : null;
}

export function planRank(id: PlanId): number {
  return PLANS.findIndex((p) => p.id === id);
}

export function basePrice(id: PlanId, period: BillingPeriod): number {
  const p = plan(id);
  return period === "YEARLY" ? p.yearly : p.monthly;
}

/** Sana (UTC yarim tun) → "YYYY-MM-DD". */
export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function discountFor(today: Date): number {
  return ymd(today) <= PROMO_UNTIL ? PROMO_PERCENT : 0;
}

export function applyDiscount(base: number, percent: number): number {
  return Math.round((base * (100 - percent)) / 100);
}

/** Oy qo'shish (31-yanvar + 1 oy = 28/29-fevral). */
export function addMonths(d: Date, n: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last)));
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

export function periodMonths(period: BillingPeriod): number {
  return period === "YEARLY" ? 12 : 1;
}

/** Davr: boshlanish kunidan oxirgi kunigacha (shu kun ham kiradi). */
export function periodEnd(start: Date, period: BillingPeriod): Date {
  return addDays(addMonths(start, periodMonths(period)), -1);
}

/** Yangi obuna yoki uzaytirish summasi. */
export function quote(id: PlanId, period: BillingPeriod, today: Date) {
  const base = basePrice(id, period);
  const discountPercent = discountFor(today);
  return { baseAmount: base, discountPercent, amount: applyDiscount(base, discountPercent) };
}

/** `today` dan `end` (shu kun ham) gacha necha oy qolgan; boshlangan oy to'liq hisoblanadi. */
export function remainingMonths(today: Date, end: Date): number {
  const endExcl = addDays(end, 1);
  let m = 0;
  while (addMonths(today, m) < endExcl && m < 24) m++;
  return m;
}

export type UpgradeQuote =
  | { ok: true; baseAmount: number; discountPercent: number; amount: number; months: number; days: number }
  | { ok: false; error: "notHigher" | "expired" };

/**
 * Obuna orasida tarifni oshirish. Misol (texnik shart): yillik 10 tagacha → 20 tagacha, 9 oy qolgan:
 * farq 1 000 000 × 9 / 12 = 750 000 so'm (chegirma muddatida undan 25% kam).
 */
export function upgradeQuote(
  current: { plan: PlanId; period: BillingPeriod; start: Date; end: Date },
  to: PlanId,
  today: Date,
): UpgradeQuote {
  if (planRank(to) <= planRank(current.plan)) return { ok: false, error: "notHigher" };
  if (today > current.end) return { ok: false, error: "expired" };
  const diff = basePrice(to, current.period) - basePrice(current.plan, current.period);
  const from = today < current.start ? current.start : today;
  const days = Math.round((addDays(current.end, 1).getTime() - from.getTime()) / 86_400_000);
  let base: number;
  let months = 0;
  if (current.period === "YEARLY") {
    months = remainingMonths(from, current.end);
    base = (diff * months) / 12;
  } else {
    // Oylik: kunlik ulush (oy 30 kun deb olinadi), bir oydan oshmaydi.
    base = (diff * Math.min(days, 30)) / 30;
  }
  // So'mgacha yaxlitlanadi (yuzlik aniqlik kerak emas).
  base = Math.round(base / 100) * 100;
  const discountPercent = discountFor(today);
  return { ok: true, baseAmount: base, discountPercent, amount: applyDiscount(base, discountPercent), months, days };
}

/** Faol tyagachlar soni tarifga sig'adimi. */
export function fitsPlan(planId: string | null | undefined, activeTractors: number): boolean {
  const limit = planLimit(planId);
  return limit === null || activeTractors <= limit;
}

/** Uzaytirish: joriy davr tugashiga 30 kun qolganda yoki tugagach. */
export const RENEW_WINDOW_DAYS = 30;

export function canRenew(end: Date | null, today: Date): boolean {
  return !end || today >= addDays(end, -RENEW_WINDOW_DAYS);
}

/** Keyingi davr boshlanishi: joriy davr tugamagan bo'lsa — undan keyingi kun, aks holda bugun. */
export function renewalStart(end: Date | null, today: Date): Date {
  return end && end >= today ? addDays(end, 1) : today;
}

/** STIR: yuridik shaxs — 9 raqam, yakka tartibdagi tadbirkor (JShShIR) — 14 raqam. */
export function normalizeInn(v: string): string | null {
  const d = v.replace(/\s/g, "");
  return /^(\d{9}|\d{14})$/.test(d) ? d : null;
}

/** Shu sondagi tyagach uchun eng kichik mos tarif. */
export function planFor(activeTractors: number): PlanId {
  return PLANS.find((p) => p.limit === null || activeTractors <= p.limit)!.id;
}
