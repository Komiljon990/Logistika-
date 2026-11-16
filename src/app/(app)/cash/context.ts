import "server-only";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/session";
import { canEdit as canEditSection } from "@/lib/access";

/**
 * Kassa sahifalari uchun umumiy holat. Tashkilotga bog'langan foydalanuvchi — o'z tashkiloti (so'rovdagi org
 * e'tiborga olinmaydi); buxgalter va Super Admin tashkilotni tanlaydi.
 */
export async function cashContext(requestedOrg?: string) {
  const user = await requireSection("cash");
  const orgs = user.orgId
    ? []
    : await db.organization.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const orgId = user.orgId ?? (orgs.some((o) => o.id === requestedOrg) ? requestedOrg! : null);
  const org = orgId ? await db.organization.findUnique({ where: { id: orgId }, select: { id: true, name: true, status: true, cashEnabled: true } }) : null;
  const enabled = !!org?.cashEnabled;
  const canEdit = canEditSection(user, "cash") && enabled && org?.status === "ACTIVE";
  // Formalarda: barcha tashkilotlar hisobchisi qaysi tashkilotga yozayotgani (server qayta tekshiradi).
  const orgField = user.orgId ? null : orgId;
  const q = user.orgId || !orgId ? "" : `org=${orgId}`;
  return { user, orgs, orgId, org, enabled, canEdit, orgField, q };
}

export type CashContext = Awaited<ReturnType<typeof cashContext>>;
