import type { DocType } from "@prisma/client";
import { daysLeft, expiryLevel } from "./docs";

/** Necha kun oldin ogohlantirila boshlanadi (texnik shart: 30, 15, 7 kun). */
export const ALERT_DAYS = 30;

export type AlertItem = {
  key: string;
  kind: "vehicle" | "driver" | "org" | "lease";
  href: string;
  owner: string;
  orgName: string;
  docType: DocType | null; // ijara uchun null
  title?: string | null; // "Boshqa" turidagi hujjat nomi
  number: string | null;
  expiresAt: Date;
};

export type AlertGroup = "expired" | "d7" | "d15" | "d30";

/** Ogohlantirishlarni guruhlarga ajratadi; 30 kundan uzoqlari tashlab yuboriladi. */
export function groupAlerts(items: AlertItem[], today: Date): Record<AlertGroup, AlertItem[]> {
  const out: Record<AlertGroup, AlertItem[]> = { expired: [], d7: [], d15: [], d30: [] };
  for (const it of items) {
    const level = expiryLevel(daysLeft(it.expiresAt, today));
    if (level === "expired" || level === "d7" || level === "d15" || level === "d30") out[level].push(it);
  }
  return out;
}
