import Link from "next/link";
import { getDict, getT } from "@/i18n";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { orgScope } from "@/lib/scope";
import { formatPhone } from "@/lib/phone";
import { StatusPill } from "@/components/StatusPill";
import { UserForm } from "../Forms";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const admin = await requirePermission("user.manage");
  const { org } = await searchParams;
  const [t, d] = [await getT(), await getDict()];
  const orgs = await db.organization.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const users = await db.user.findMany({
    where: orgScope(admin, org),
    orderBy: [{ status: "asc" }, { fullName: "asc" }],
    include: { org: { select: { name: true } } },
  });
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{t("user.title")}</h1>
        <span className="flex-1" />
        <form className="flex gap-2">
          <select name="org" defaultValue={org ?? ""} className="input w-auto" aria-label={t("user.org")}>
            <option value="">{t("home.allOrgs")}</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <button className="btn-ghost">OK</button>
        </form>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">{t("user.fullName")}</th>
              <th className="px-4 py-2 font-medium">{t("user.phone")}</th>
              <th className="px-4 py-2 font-medium">{t("user.role")}</th>
              <th className="px-4 py-2 font-medium">{t("user.org")}</th>
              <th className="px-4 py-2 font-medium">{t("common.status")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-line">
                <td className="px-4 py-2.5"><Link href={`/admin/users/${u.id}`} className="text-accent hover:underline">{u.fullName}</Link></td>
                <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{formatPhone(u.phone)}</td>
                <td className="px-4 py-2.5">{t(`role.${u.role}`)}</td>
                <td className="px-4 py-2.5">{u.org?.name ?? <span className="text-muted">{t("home.allOrgs")}</span>}</td>
                <td className="px-4 py-2.5"><StatusPill status={u.status} t={t} /></td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-muted">{t("common.none")}</td></tr>}
          </tbody>
        </table>
      </div>
      <section id="new" className="card grid gap-4 p-5">
        <h2 className="text-lg font-semibold">{t("user.new")}</h2>
        <UserForm d={d} orgs={orgs} defaultOrgId={org} />
      </section>
    </div>
  );
}
