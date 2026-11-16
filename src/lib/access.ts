/**
 * Bo'limlar bo'yicha huquq (17.11.2026, sof — bazasiz, testlanadi).
 *
 * Mutaxassis (SPECIALIST) — rahbar har bo'lim uchun belgilaydi: "faqat ko'rish" (VIEW) yoki
 * "kiritish, tahrirlash va o'chirish" (EDIT); belgilanmagan bo'lim unga umuman ko'rinmaydi.
 * Qolgan rollar uchun avvalgi qoidalar o'zgarmaydi (roles.ts dagi jadvaldan olinadi).
 */
import type { Role } from "@prisma/client";
import { can, type Permission } from "./roles";

export const SECTIONS = ["trips", "clients", "settlements", "cash", "vehicles", "drivers", "tir", "dazvol", "orgdocs", "reports"] as const;
export type Section = (typeof SECTIONS)[number];
export type Level = "VIEW" | "EDIT";
export type Access = Partial<Record<Section, Level>>;

/** Boshqa rollar uchun bo'limni tahrirlash qaysi huquqqa bog'liq (null — hech kim tahrirlamaydi, faqat ko'rish). */
const ROLE_EDIT: Record<Section, Permission | null> = {
  trips: "data.edit",
  clients: "data.edit",
  settlements: "data.edit",
  cash: "cash.edit",
  vehicles: "data.edit",
  drivers: "data.edit",
  tir: "data.edit",
  dazvol: "data.edit",
  orgdocs: "orgdoc.edit",
  reports: null,
};

/** Bo'lim qaysi sahifada (menyu va yo'naltirish uchun). */
export const SECTION_HREF: Record<Section, string> = {
  trips: "/trips", clients: "/clients", settlements: "/settlements", cash: "/cash", vehicles: "/vehicles",
  drivers: "/drivers", tir: "/tir", dazvol: "/dazvol", orgdocs: "/org-docs", reports: "/reports",
};

/** Bazadagi JSON'ni tekshirib o'qiydi: faqat ma'lum bo'limlar va VIEW/EDIT qiymatlari. */
export function parseAccess(v: unknown): Access {
  const out: Access = {};
  if (!v || typeof v !== "object") return out;
  for (const s of SECTIONS) {
    const lv = (v as Record<string, unknown>)[s];
    if (lv === "VIEW" || lv === "EDIT") out[s] = lv;
  }
  return out;
}

/** Formadan: "acc_<bo'lim>" belgilangan bo'lsa — "lvl_<bo'lim>" (VIEW | EDIT, sukut bo'yicha VIEW). */
export function accessFromForm(formData: FormData): Access {
  const out: Access = {};
  for (const s of SECTIONS) {
    if (formData.get(`acc_${s}`) !== "on") continue;
    out[s] = formData.get(`lvl_${s}`) === "EDIT" ? "EDIT" : "VIEW";
  }
  return out;
}

export type AccessUser = { role: Role; access?: Access | null };

export function sectionLevel(user: AccessUser, s: Section): Level | null {
  if (user.role === "SPECIALIST") return user.access?.[s] ?? null;
  const edit = ROLE_EDIT[s];
  if (edit && can(user.role, edit)) return "EDIT";
  return can(user.role, "data.view") ? "VIEW" : null;
}

export function canView(user: AccessUser, s: Section): boolean {
  return sectionLevel(user, s) !== null;
}

export function canEdit(user: AccessUser, s: Section): boolean {
  return sectionLevel(user, s) === "EDIT";
}

/** Mutaxassis uchun keyingi tartib raqami (bo'sh joy to'ldirilmaydi — raqam xodimga doimiy biriktiriladi). */
export function nextSpecialistNo(used: (number | null)[]): number {
  return used.reduce<number>((m, n) => Math.max(m, n ?? 0), 0) + 1;
}

/** Rol nomi: Mutaxassis-1, Mutaxassis-2 …; boshqa rollar — lug'atdagi nom. */
export function roleTitle(t: (k: `role.${Role}`) => string, user: { role: Role; specialistNo?: number | null }): string {
  const base = t(`role.${user.role}`);
  return user.role === "SPECIALIST" && user.specialistNo ? `${base}-${user.specialistNo}` : base;
}
