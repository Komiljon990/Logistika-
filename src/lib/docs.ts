import type { DocType } from "@prisma/client";

export const VEHICLE_DOC_TYPES: readonly DocType[] = [
  "TECH_PASSPORT", "OWNERSHIP_DOC", "LEASE_CONTRACT", "LICENSE",
  "INSURANCE", "PERMIT", "INSPECTION", "TACHOGRAPH", "OTHER",
];

export const DRIVER_DOC_TYPES: readonly DocType[] = [
  "PASSPORT", "FOREIGN_PASSPORT", "DRIVING_LICENSE", "ADR", "CERTIFICATE", "VISA", "OTHER",
];

/** Texnik shart 3-bo'lim: bu hujjatlarda fayl majburiy, qolganlarida ixtiyoriy. */
export const FILE_REQUIRED: readonly DocType[] = ["TECH_PASSPORT", "OWNERSHIP_DOC", "LEASE_CONTRACT"];

export type ExpiryLevel = "expired" | "d7" | "d15" | "d30" | "ok" | "none";

/** Muddatgacha qolgan kunlar (Toshkent sanasi bo'yicha); muddat yo'q bo'lsa null. */
export function tashkentToday(now: Date = new Date()): Date {
  return new Date(now.getTime() + 5 * 3_600_000); // UTC+5, yozgi vaqt yo'q
}

export function daysLeft(expiresAt: Date | null, today: Date = tashkentToday()): number | null {
  if (!expiresAt) return null;
  const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const e = Date.UTC(expiresAt.getUTCFullYear(), expiresAt.getUTCMonth(), expiresAt.getUTCDate());
  return Math.round((e - t) / 86_400_000);
}

/** Ogohlantirish chegaralari: 30, 15, 7 kun qoldi va muddati o'tgan. */
export function expiryLevel(days: number | null): ExpiryLevel {
  if (days === null) return "none";
  if (days < 0) return "expired";
  if (days <= 7) return "d7";
  if (days <= 15) return "d15";
  if (days <= 30) return "d30";
  return "ok";
}

/** Davlat raqamini bir xil ko'rinishga keltiradi: "01 a 777 aa" → "01A777AA". */
export function normalizePlate(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, "");
}
