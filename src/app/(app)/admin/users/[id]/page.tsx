import { notFound } from "next/navigation";
import { getDict, getT, getLocale } from "@/i18n";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { StatusPill } from "@/components/StatusPill";
import { UserControls, UserForm } from "../../Forms";

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePermission("user.manage");
  const { id } = await params;
  const [t, d, locale] = [await getT(), await getDict(), await getLocale()];
  const user = await db.user.findUnique({ where: { id } });
  if (!user) notFound();
  const orgs = await db.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const fmt = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "uz-UZ", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Tashkent" });
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{user.fullName}</h1>
        <StatusPill status={user.status} t={t} />
      </div>
      <p className="text-sm text-muted">{t("user.lastLogin")}: {user.lastLoginAt ? fmt.format(user.lastLoginAt) : "—"}</p>
      <section className="card p-5"><UserForm d={d} orgs={orgs} user={{ id: user.id, fullName: user.fullName, phone: user.phone, role: user.role, orgId: user.orgId }} /></section>
      {user.id !== admin.id && (
        <section className="card p-5"><UserControls d={d} id={user.id} status={user.status} /></section>
      )}
    </div>
  );
}
