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
  "data.view": ["SUPER_ADMIN", "ACCOUNTANT", "MANAGER", "DIRECTOR", "DEPUTY"],
  "data.edit": ["MANAGER"],
  "salary.official.edit": ["ACCOUNTANT"],
  "hard.delete": ["SUPER_ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}
