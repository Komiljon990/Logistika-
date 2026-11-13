import type { DocType } from "@prisma/client";

export type DocOwnerKind = "vehicle" | "driver" | "org";

export const VEHICLE_DOC_TYPES: readonly DocType[] = [
  "TECH_PASSPORT", "LICENSE", "INSPECTION", "INSURANCE", "OWNERSHIP_DOC", "LEASE_CONTRACT",
  "PERMIT", "TACHOGRAPH", "OTHER",
];

export const DRIVER_DOC_TYPES: readonly DocType[] = [
  "DRIVING_LICENSE", "PASSPORT", "FOREIGN_PASSPORT", "CERTIFICATE", "ADR", "VISA", "OTHER",
];

export const ORG_DOC_TYPES: readonly DocType[] = [
  "ORG_CERTIFICATE", "CHARTER", "LICENSE", "BANK_DETAILS", "OTHER",
];

export const DOC_TYPES: Record<DocOwnerKind, readonly DocType[]> = {
  vehicle: VEHICLE_DOC_TYPES,
  driver: DRIVER_DOC_TYPES,
  org: ORG_DOC_TYPES,
};

/**
 * Har kartochkada bo'lishi kutiladigan asosiy hujjatlar: kiritilmagan bo'lsa "tez qo'shish" tugmasi chiqadi.
 * Transport: texpasport, litsenziya, texnik ko'rik, sug'urta. Haydovchi: guvohnoma, pasport, zagran pasport, sertifikat.
 */
export const RECOMMENDED: Record<DocOwnerKind, readonly DocType[]> = {
  vehicle: ["TECH_PASSPORT", "LICENSE", "INSPECTION", "INSURANCE"],
  driver: ["DRIVING_LICENSE", "PASSPORT", "FOREIGN_PASSPORT", "CERTIFICATE"],
  org: ["ORG_CERTIFICATE", "CHARTER", "LICENSE", "BANK_DETAILS"],
};

/** Texnik shart 4-bo'lim: bu hujjatlarda fayl majburiy, qolganlarida ixtiyoriy. */
export const FILE_REQUIRED: readonly DocType[] = ["TECH_PASSPORT", "OWNERSHIP_DOC", "LEASE_CONTRACT"];

/** Asosiy hujjatlardan qaysilari hali faol holatda kiritilmagan. */
export function missingDocs(kind: DocOwnerKind, activeTypes: readonly DocType[]): DocType[] {
  return RECOMMENDED[kind].filter((t) => !activeTypes.includes(t));
}

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

/** Bugundan `days` kun keyingi sana (Toshkent bo'yicha, kun boshi, UTC). */
export function dayOffset(days: number, today: Date = tashkentToday()): Date {
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + days));
}

/** Davlat raqamini bir xil ko'rinishga keltiradi: "01 a 777 aa" → "01A777AA". */
export function normalizePlate(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, "");
}
