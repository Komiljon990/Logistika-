import type { Role } from "@prisma/client";

/** Rollar ikki guruhga bo'linadi: bitta tashkilotga bog'langan va barcha tashkilotlarni ko'radigan. */
export const GLOBAL_ROLES: readonly Role[] = ["SUPER_ADMIN", "ACCOUNTANT"];
export const ORG_ROLES: readonly Role[] = ["MANAGER", "DIRECTOR", "DEPUTY"];

export function isGlobalRole(role: Role): boolean {
  return GLOBAL_ROLES.includes(role);
}

/**
 * Huquqlar jadvali. Rol tizimi qattiq kodlanmasligi uchun barcha tekshiruvlar shu yerdan o'tadi:
 * keyinchalik buxgalter huquqlarini kengaytirish faqat shu jadvalni o'zgartiradi.
 */
export const PERMISSIONS = {
  "admin.access": ["SUPER_ADMIN"],
  "org.manage": ["SUPER_ADMIN"],
  "user.manage": ["SUPER_ADMIN"],
  // Rahbar o'z tashkiloti xodimlarini ko'radi (parol tiklash qoidasi: canResetPassword).
  "team.view": ["DIRECTOR"],
  "data.view": ["SUPER_ADMIN", "ACCOUNTANT", "MANAGER", "DIRECTOR", "DEPUTY"],
  "data.edit": ["MANAGER"],
  // Tashkilot hujjatlari (guvohnoma, ustav, litsenziya, bank rekvizitlari) — 13.11.2026 talabi.
  "orgdoc.edit": ["MANAGER", "DIRECTOR", "ACCOUNTANT"],
  // Menyuda muddati yaqin hujjatlar soni ko'rinadi.
  "alerts.badge": ["MANAGER", "DIRECTOR"],
  // Tashkilot valyutalari ro'yxatini rahbar boshqaradi (13.11.2026).
  "currency.manage": ["DIRECTOR"],
  // Transportni o'chirish: faqat xato kiritilgan, hech narsaga bog'lanmagan transport (aks holda nofaol qilinadi).
  "vehicle.delete": ["MANAGER", "SUPER_ADMIN"],
  "salary.official.edit": ["ACCOUNTANT"],
  "hard.delete": ["SUPER_ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

/** Rahbar faqat o'z tashkilotidagi shu rollar parolini o'zgartira oladi. */
export const DIRECTOR_RESETTABLE_ROLES: readonly Role[] = ["MANAGER", "DEPUTY"];

type PasswordParty = { id: string; role: Role; orgId: string | null };

/**
 * Kim kimning parolini qo'lda o'zgartira oladi:
 * - Super Admin: istalgan foydalanuvchini (o'zidan tashqari).
 * - Rahbar: faqat o'z tashkilotidagi menejer va ishonchli vakilni.
 * - Barcha tashkilotlar uchun ishlaydigan foydalanuvchilar (Buxgalter) va rahbarning o'zi: faqat Super Admin.
 */
export function canResetPassword(actor: PasswordParty, target: PasswordParty): boolean {
  if (actor.id === target.id) return false;
  if (actor.role === "SUPER_ADMIN") return true;
  if (actor.role === "DIRECTOR") {
    return !!actor.orgId && target.orgId === actor.orgId && DIRECTOR_RESETTABLE_ROLES.includes(target.role);
  }
  return false;
}
