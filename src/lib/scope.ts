import type { Role } from "@prisma/client";
import { isGlobalRole } from "./roles";

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
 * - Menejer, rahbar, vakil: tashkilot har doim sessiyadagi foydalanuvchidan olinadi.
 *   Mijoz boshqa `requestedOrgId` yuborsa ham e'tiborga olinmaydi.
 * - Buxgalter va Super Admin: hamma tashkilot, yoki xohlasa bittasiga filtr.
 */
export function orgScope(user: ScopeUser, requestedOrgId?: string | null): { orgId?: string } {
  if (isGlobalRole(user.role)) {
    return requestedOrgId ? { orgId: requestedOrgId } : {};
  }
  if (!user.orgId) throw new ForbiddenError("Foydalanuvchi tashkilotga biriktirilmagan");
  return { orgId: user.orgId };
}

/** Yangi yozuv yaratilganda qaysi tashkilotga yozilishini aniqlaydi. */
export function orgForWrite(user: ScopeUser, requestedOrgId?: string | null): string {
  if (isGlobalRole(user.role)) {
    if (!requestedOrgId) throw new ForbiddenError("Tashkilot tanlanmagan");
    return requestedOrgId;
  }
  if (!user.orgId) throw new ForbiddenError("Foydalanuvchi tashkilotga biriktirilmagan");
  return user.orgId;
}

/** Bitta yozuvni o'qishdan oldin: u foydalanuvchi ko'ra oladigan tashkilotga tegishlimi. */
export function assertCanSeeOrg(user: ScopeUser, recordOrgId: string | null): void {
  if (isGlobalRole(user.role)) return;
  if (!user.orgId || recordOrgId !== user.orgId) throw new ForbiddenError();
}
