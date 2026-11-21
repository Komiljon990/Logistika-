import Link from "next/link";
import { canEdit as canEditSection } from "@/lib/access";
import { getT } from "@/i18n";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/session";
import { Documents } from "../Documents";

/**
 * Tashkilot hujjatlari: guvohnoma, ustav, litsenziya, bank rekvizitlari.
 * Tashkilot foydalanuvchisi faqat o'z tashkilotini ko'radi (so'rovdagi org e'tiborga olinmaydi);
 * buxgalter va Super Admin tashkilotni tanlaydi.
 */
export default async function OrgDocsPage({ searchParams }: { searchParams: Promise<{ org?: string; docs?: string }> }) {
  const user = await requireSection("orgdocs");
  const sp = await searchParams;
  const t = await getT();
  const orgs = user.orgId
    ? []
    : await db.organization.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const orgId = user.orgId ?? (orgs.some((o) => o.id === sp.org) ? sp.org! : null);
  const org = orgId ? await db.organization.findUnique({ where: { id: orgId }, select: { id: true, name: true, status: true } }) : null;
  const canEdit = canEditSection(user, "orgdocs") && org?.status === "ACTIVE";

  return (
    <div className="grid gap-6">
      <Link href="/settings" className="text-sm text-accent hover:underline">← {t("settings.title")}</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{t("orgdoc.title")}</h1>
        {user.orgId && org && <span className="text-muted">{org.name}</span>}
        <span className="flex-1" />
        {!user.orgId && (
          <form className="flex gap-2">
            <select name="org" defaultValue={orgId ?? ""} aria-label={t("common.org")} className="input w-auto">
              <option value="">{t("orgdoc.pickOrg")}</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <button className="btn-ghost">OK</button>
          </form>
        )}
      </div>
      {!canEditSection(user, "orgdocs") && <p className="text-sm text-muted">{t("common.viewOnly")}</p>}
      {org ? (
        <Documents owner={{ kind: "org", id: org.id }} canEdit={canEdit} showArchived={sp.docs === "all"} />
      ) : (
        <p className="card px-4 py-6 text-sm text-muted">{t("orgdoc.pickOrg")}</p>
      )}
    </div>
  );
}
