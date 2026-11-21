import type { Role } from "@prisma/client";

export type ScopeUser = { id: string; role: Role; orgId: string | null };

export class ForbiddenError extends Error {
  constructor(message = "Ruxsat yo'q") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Markaziy tashkilot filtri. Tashkilotga tegishli har bir so'rov `where` sharti shu funksiyadan olinadi;
 * qo'lda `orgId` filtri yozish taqiqlangan.
 *
 * 16.11.2026 dan: tashkilot ma'lumotlarini faqat shu tashkilot a'zosi ko'radi — tashkilot har doim sessiyadagi
 * a'zolikdan olinadi, mijoz yuborgan `requestedOrgId` e'tiborga olinmaydi. Tashkilotsiz foydalanuvchi (Super Admin)
 * hech qanday tashkilot ma'lumotini ololmaydi. Bir shaxs bir nechta tashkilotda bo'lsa, ma'lumotlar jamlanmaydi:
 * u tashkilotni almashtiradi (har biri alohida sessiya a'zoligi).
 */
export function orgScope(user: ScopeUser, _requestedOrgId?: string | null): { orgId: string } {
  if (user.orgId) return { orgId: user.orgId };
  throw new ForbiddenError("Foydalanuvchi tashkilotga biriktirilmagan");
}

/** Yangi yozuv yaratilganda qaysi tashkilotga yozilishini aniqlaydi. */
export function orgForWrite(user: ScopeUser, _requestedOrgId?: string | null): string {
  if (user.orgId) return user.orgId;
  throw new ForbiddenError("Foydalanuvchi tashkilotga biriktirilmagan");
}

/** Bitta yozuvni o'qishdan oldin: u foydalanuvchining tashkilotiga tegishlimi. */
export function assertCanSeeOrg(user: ScopeUser, recordOrgId: string | null): void {
  if (!user.orgId || recordOrgId !== user.orgId) throw new ForbiddenError();
}

/** Barcha tashkilotlarni ko'radimi — endi hech kim (tashkilot ustuni/tanlovi ko'rsatilmaydi). */
export function seesAllOrgs(_user: ScopeUser): boolean {
  return false;
}
