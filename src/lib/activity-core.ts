import type { Prisma, Role } from "@prisma/client";

/**
 * "Oxirgi amallar" kimga ko'rinadi (bazasiz, testlanadi): har kim o'z amallarini; rahbar — butun tashkilotniki
 * (14.11.2026). Tashkilotga bog'langan foydalanuvchi faqat o'z tashkiloti ichidagi yozuvlarni ko'radi.
 */
export function activityWhere(user: { id: string; role: Role; orgId: string | null }, mineOnly: boolean): Prisma.AuditLogWhereInput {
  if (user.role === "DIRECTOR" && user.orgId && !mineOnly) return { orgId: user.orgId };
  return { actorId: user.id, ...(user.orgId ? { orgId: user.orgId } : {}) };
}

/** Qaysi yaratish amalini bekor qilib bo'ladi va buning uchun qaysi huquq kerak (hujjat — egasiga qarab aniqlanadi). */
export const UNDOABLE = {
  "payment.create": "data.edit",
  "charge.create": "data.edit",
  "trip.create": "data.edit",
  "client.create": "data.edit",
  "vehicle.create": "data.edit",
  "driver.create": "data.edit",
  "document.create": "data.edit",
  "document.renew": "data.edit",
  "expense.create": "cash.edit",
  "transfer.create": "cash.edit",
  "account.create": "cash.edit",
} as const;
