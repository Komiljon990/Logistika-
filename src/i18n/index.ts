import "server-only";
import { cookies } from "next/headers";
import { uz, type Dict } from "./uz";
import { uzCyrl } from "./uzCyrl";
import { ru } from "./ru";

export const LOCALES = ["uz", "uz-Cyrl", "ru"] as const;
export type Locale = (typeof LOCALES)[number];
export const LANG_COOKIE = "lang";

const DICTS: Record<Locale, Dict> = { uz, "uz-Cyrl": uzCyrl, ru };

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return isLocale(v) ? v : "uz";
}

export async function getT() {
  const dict = DICTS[await getLocale()];
  return (key: keyof Dict) => dict[key];
}

export type T = Awaited<ReturnType<typeof getT>>;

/** Client komponentlarga uzatish uchun butun lug'at (kichik, faqat matnlar). */
export async function getDict(): Promise<Dict> {
  return DICTS[await getLocale()];
}

export type { Dict };
