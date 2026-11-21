import type { TripEventType } from "@prisma/client";

/**
 * Holatlar tartibi (bot va menejer uchun bir xil).
 * 18.11.2026: "O'zbekistondan chiqdi / kirdi" bosqichlari olib tashlandi — tashish butunlay xorijda
 * bo'lishi mumkin (masalan Xitoy → Polsha). Eski yozuvlar bazada qoladi, lekin ko'rsatilmaydi va hisobga olinmaydi.
 */
export const EVENT_ORDER: readonly TripEventType[] = ["ACCEPTED", "ARRIVED_LOADING", "LOADED", "ARRIVED_UNLOADING", "UNLOADED"];

export type DoneEvents = Partial<Record<TripEventType, Date>>;

/** Hozir belgilash mumkin bo'lgan holat (zanjirdagi birinchi belgilanmagani). */
export function nextEvents(done: DoneEvents): TripEventType[] {
  const next = EVENT_ORDER.find((t) => !done[t]);
  return next ? [next] : [];
}

/** Shu holatdan oldin bo'lishi shart bo'lgan eng so'nggi holat (vaqt tartibini tekshirish uchun). */
export function previousEvent(type: TripEventType, done: DoneEvents): TripEventType | null {
  const idx = EVENT_ORDER.indexOf(type);
  for (let i = idx - 1; i >= 0; i--) if (done[EVENT_ORDER[i]]) return EVENT_ORDER[i];
  return null;
}

export type EventCheck = { ok: true } | { ok: false; error: "trip.error.order" | "trip.error.time" | "trip.error.future" };

/** Holatni qo'shish mumkinmi: tartib, oldingi holatdan oldin emas, kelajakda emas (5 daqiqa ruxsat). */
export function checkEvent(type: TripEventType, at: Date, done: DoneEvents, now: Date = new Date()): EventCheck {
  if (!nextEvents(done).includes(type)) return { ok: false, error: "trip.error.order" };
  if (at.getTime() > now.getTime() + 5 * 60_000) return { ok: false, error: "trip.error.future" };
  const prev = previousEvent(type, done);
  if (prev && at.getTime() < done[prev]!.getTime()) return { ok: false, error: "trip.error.time" };
  return { ok: true };
}

/** Transport band: tashish faol va yuk hali tushirilmagan. */
export function isLoaded(status: "ACTIVE" | "COMPLETED" | "CANCELLED", done: DoneEvents): boolean {
  return status === "ACTIVE" && !done.UNLOADED;
}

/** Tashish yuk tushirilganda yakunlanadi. */
export function completesTrip(done: DoneEvents): boolean {
  return !!done.UNLOADED;
}

/** Hozirgi bosqich (ko'rsatish uchun): oxirgi belgilangan holat. */
export function currentStage(done: DoneEvents): TripEventType | null {
  for (let i = EVENT_ORDER.length - 1; i >= 0; i--) if (done[EVENT_ORDER[i]]) return EVENT_ORDER[i];
  return null;
}

export function tripNumber(n: number): string {
  return `TSH-${String(n).padStart(4, "0")}`;
}

/** Brauzerdagi "YYYY-MM-DDTHH:mm" (Toshkent vaqti) → UTC sana. */
export function parseTashkentDateTime(v: string | null | undefined): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const d = new Date(`${v}:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() - 5 * 3_600_000);
}

/** UTC → "dd.mm.yyyy HH:mm" Toshkent vaqtida. */
export function formatTashkent(d: Date): string {
  const t = new Date(d.getTime() + 5 * 3_600_000).toISOString();
  return `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)} ${t.slice(11, 16)}`;
}

/** Hozirgi Toshkent vaqti "YYYY-MM-DDTHH:mm" ko'rinishida (forma uchun boshlang'ich qiymat). */
export function tashkentNowInput(now: Date = new Date()): string {
  return new Date(now.getTime() + 5 * 3_600_000).toISOString().slice(0, 16);
}

/** Mijoz mas'ul shaxsi telefoni: xorijiy raqamlar ham bo'lishi mumkin — 7–15 raqam, ixtiyoriy "+". */
export function normalizeContactPhone(v: string): string | null {
  const trimmed = v.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  if (digits.length === 9) return `+998${digits}`;
  return `+${digits}`;
}
