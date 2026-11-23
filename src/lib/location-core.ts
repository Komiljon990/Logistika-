/**
 * Haydovchi joylashuvi (23.11.2026) — sof hisob-kitob (bazasiz, testlanadi).
 *
 * Haydovchi Telegram'da "jonli joylashuv"ni ulashadi. Telegram har harakatda xabarni tahrirlaydi (edited_message),
 * shuning uchun yangilanishlar ko'p keladi: oxirgi nuqta har safar yangilanadi, tarixga esa faqat 5 daqiqada bir
 * yoki 1 km dan ko'p yurganda yoziladi.
 */

/** Tarixga yozish oralig'i. */
export const STORE_EVERY_MS = 5 * 60_000;
export const STORE_EVERY_KM = 1;
/** Eslatma: ulashish to'xtagan bo'lsa, eng ko'pi bilan shu oraliqda bir marta. */
export const REMIND_EVERY_MS = 3 * 3_600_000;
/** Jonli ulashish yoqiq bo'lsa ham shuncha vaqt yangilanmasa — "yangilanmayapti" deb hisoblanadi. */
export const STALE_MS = 6 * 3_600_000;
/** Xaritada "yangi" (yashil) hisoblanadigan muddat. */
export const FRESH_MS = 30 * 60_000;
/** Tarix shuncha kundan keyin o'chiriladi. */
export const KEEP_DAYS = 180;
/** Telegram'ning "Men o'chirgunimcha" qiymati (0x7FFFFFFF soniya). */
export const LIVE_FOREVER = 0x7fffffff;
const MAX_DATE = Date.UTC(2100, 0, 1);

export type Point = { lat: number; lng: number };

export function validPoint(lat: unknown, lng: unknown): lat is number {
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/** Ikki nuqta orasidagi masofa, km (haversine). */
export function distanceKm(a: Point, b: Point): number {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Yangi nuqta tarixga yozilsinmi (oxirgi yozilgan nuqtaga nisbatan). */
export function shouldStore(prev: (Point & { at: Date }) | null, next: Point, now: Date): boolean {
  if (!prev) return true;
  if (now.getTime() - prev.at.getTime() >= STORE_EVERY_MS) return true;
  return distanceKm(prev, next) >= STORE_EVERY_KM;
}

/**
 * Jonli ulashish qachon tugaydi. `sentAt` — xabar yuborilgan vaqt (Telegram `date`, soniya), `livePeriod` — soniya.
 * "Men o'chirgunimcha" — juda katta son, 2100-yil bilan cheklanadi.
 */
export function liveUntilFrom(sentAtSec: number, livePeriodSec: number): Date {
  return new Date(Math.min(MAX_DATE, (sentAtSec + livePeriodSec) * 1000));
}

export type LocState = "LIVE" | "STALE" | "STOPPED" | "NONE";

/** Xaritadagi rang: yashil — jonli, sariq — yangilanmayapti, kulrang — to'xtagan. */
export const LOC_COLORS: Record<LocState, string> = { LIVE: "#16a34a", STALE: "#d97706", STOPPED: "#6b7280", NONE: "#9ca3af" };

/**
 * Xaritadagi holat:
 * - LIVE — ulashish yoqiq va oxirgi nuqta 6 soatdan yangi;
 * - STALE — ulashish yoqiq, lekin 6 soatdan beri yangilanmagan (telefon o'chgan yoki internet yo'q);
 * - STOPPED — ulashish to'xtagan (oxirgi joy ma'lum);
 * - NONE — hali hech qachon yubormagan.
 */
export function locState(d: { lastLocAt: Date | null; liveUntil: Date | null }, now: Date): LocState {
  if (!d.lastLocAt) return "NONE";
  const live = !!d.liveUntil && d.liveUntil.getTime() > now.getTime();
  if (!live) return "STOPPED";
  return now.getTime() - d.lastLocAt.getTime() > STALE_MS ? "STALE" : "LIVE";
}

/** Toshkent soati (UTC+5). */
export function tashkentHour(now: Date): number {
  return (now.getUTCHours() + 5) % 24;
}

/**
 * Botdan eslatma yuborilsinmi: kuzatuv yoqilgan, botga ulangan, faol reysi bor, ulashish to'xtagan yoki
 * yangilanmayapti, oxirgi eslatmadan 3 soat o'tgan, va Toshkent vaqti bilan 8:00–21:59 (tunda bezovta qilinmaydi).
 */
export function needsReminder(
  d: { trackLocation: boolean; telegramChatId: string | null; lastLocAt: Date | null; liveUntil: Date | null; locRemindedAt: Date | null; hasActiveTrip: boolean },
  now: Date,
): boolean {
  if (!d.trackLocation || !d.telegramChatId || !d.hasActiveTrip) return false;
  const h = tashkentHour(now);
  if (h < 8 || h >= 22) return false;
  if (d.locRemindedAt && now.getTime() - d.locRemindedAt.getTime() < REMIND_EVERY_MS) return false;
  return locState(d, now) !== "LIVE";
}
