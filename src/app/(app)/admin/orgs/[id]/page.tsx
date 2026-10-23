import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict, getT } from "@/i18n";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { formatPhone } from "@/lib/phone";
import { StatusPill } from "@/components/StatusPill";
import { OrgForm } from "../../Forms";
import { setOrgStatus } from "../../actions";

export default async function OrgPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("org.manage");
  const { id } = await params;
  const [t, d] = [await getT(), await getDict()];
  const org = await db.organization.findUnique({ where: { id }, include: { users: { orderBy: { fullName: "asc" } } } });
  if (!org) notFound();
  const toggle = setOrgStatus.bind(null, org.id, org.status === "ACTIVE" ? "BLOCKED" : "ACTIVE");
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{org.name}</h1>
        <StatusPill status={org.status} t={t} />
        <span className="flex-1" />
        <form action={toggle}>
          <button className={org.status === "ACTIVE" ? "btn-danger" : "btn-ghost"}>
            {org.status === "ACTIVE" ? t("common.block") : t("common.unblock")}
          </button>
        </form>
      </div>
      <section className="card p-5"><OrgForm d={d} org={org} /></section>
      <section className="grid gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">{t("org.users")}</h2>
          <Link href={`/admin/users?org=${org.id}#new`} className="btn-ghost">{t("user.new")}</Link>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {org.users.map((u) => (
                <tr key={u.id} className="border-t border-line first:border-t-0">
                  <td className="px-4 py-2.5"><Link href={`/admin/users/${u.id}`} className="text-accent hover:underline">{u.fullName}</Link></td>
                  <td className="px-4 py-2.5 tabular-nums">{formatPhone(u.phone)}</td>
                  <td className="px-4 py-2.5">{t(`role.${u.role}`)}</td>
                  <td className="px-4 py-2.5"><StatusPill status={u.status} t={t} /></td>
                </tr>
              ))}
              {org.users.length === 0 && <tr><td className="px-4 py-6 text-muted">{t("common.none")}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
