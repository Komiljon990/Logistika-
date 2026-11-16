import type { Role } from "@prisma/client";

/**
 * Faqat Super Admin tashkilotsiz (16.11.2026): u tashkilot va rahbar qo'shadi, ma'lumotlarni ko'rmaydi.
 * Qolgan barcha rollar (buxgalter ham) tashkilotga a'zolik orqali ishlaydi; bir shaxs bir nechta tashkilotda bo'lishi mumkin.
 */
export const GLOBAL_ROLES: readonly Role[] = ["SUPER_ADMIN"];
export const ORG_ROLES: readonly Role[] = ["MANAGER", "DIRECTOR", "DEPUTY", "ACCOUNTANT"];

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
  // Super Admin: tashkilot rahbarlarini qo'shadi va bloklaydi (parolini tiklay olmaydi).
  "user.manage": ["SUPER_ADMIN"],
  // Rahbar o'z tashkiloti xodimlarini (menejer, buxgalter, vakil) qo'shadi va boshqaradi (parolini tiklay olmaydi).
  "team.view": ["DIRECTOR"],
  "team.manage": ["DIRECTOR"],
  // Tashkilot ma'lumotlari: faqat a'zolar. Super Admin ko'rmaydi (faqat foydalanuvchi bergan vaqtincha parol bilan).
  "data.view": ["ACCOUNTANT", "MANAGER", "DIRECTOR", "DEPUTY"],
  "data.edit": ["MANAGER"],
  // Tashkilot hujjatlari (guvohnoma, ustav, litsenziya, bank rekvizitlari) — 13.11.2026 talabi.
  "orgdoc.edit": ["MANAGER", "DIRECTOR", "ACCOUNTANT"],
  // Menyuda muddati yaqin hujjatlar soni ko'rinadi.
  "alerts.badge": ["MANAGER", "DIRECTOR"],
  // Tashkilot valyutalari ro'yxatini rahbar boshqaradi (13.11.2026).
  "currency.manage": ["DIRECTOR"],
  // Transportni o'chirish: faqat xato kiritilgan, hech narsaga bog'lanmagan transport (aks holda nofaol qilinadi).
  "vehicle.delete": ["MANAGER"],
  // Kassa (14.11.2026): hisob raqamlar, xarajat, o'tkazmalarni hisobchi va menejer kiritadi; hamma ko'radi.
  "cash.edit": ["ACCOUNTANT", "MANAGER"],
  // Kassa bo'limini yoqish/o'chirish va xarajat turkumlarini sozlash — rahbar.
  "cash.settings": ["DIRECTOR"],
  "salary.official.edit": ["ACCOUNTANT"],
  "hard.delete": ["SUPER_ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

// Parolni boshqa birov tiklay olmaydi (16.11.2026): har kim o'z e-mailiga kelgan kod orqali tiklaydi.
