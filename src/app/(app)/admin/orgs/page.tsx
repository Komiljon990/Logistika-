import Link from "next/link";
import { getDict, getT } from "@/i18n";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { StatusPill } from "@/components/StatusPill";
import { OrgForm } from "../Forms";

/** Super Admin: tashkilotlar ro'yxati (demo tashkilot ko'rinmaydi) va yangi tashkilot + rahbar. */
export default async function OrgsPage() {
  await requirePermission("org.manage");
  const [t, d] = [await getT(), await getDict()];
  const orgs = await db.organization.findMany({
    where: { isDemo: false },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: { users: { where: { role: "DIRECTOR", status: "ACTIVE" }, select: { fullName: true } }, _count: { select: { users: true } } },
  });
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold">{t("org.title")}</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">{t("common.name")}</th>
              <th className="px-4 py-2 font-medium">{t("org.inn")}</th>
              <th className="px-4 py-2 font-medium">{t("role.DIRECTOR")}</th>
              <th className="px-4 py-2 font-medium">{t("org.users")}</th>
              <th className="px-4 py-2 font-medium">{t("common.status")}</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((o) => (
              <tr key={o.id} className="border-t border-line">
                <td className="px-4 py-2.5"><Link href={`/admin/orgs/${o.id}`} className="text-accent hover:underline">{o.name}</Link></td>
                <td className="px-4 py-2.5 tabular-nums">{o.inn ?? "—"}</td>
                <td className="px-4 py-2.5">{o.users.map((u) => u.fullName).join(", ") || "—"}</td>
                <td className="px-4 py-2.5 tabular-nums">{o._count.users}</td>
                <td className="px-4 py-2.5"><StatusPill status={o.status} t={t} /></td>
              </tr>
            ))}
            {orgs.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-muted">{t("common.none")}</td></tr>}
          </tbody>
        </table>
      </div>
      <section className="card grid gap-4 p-5">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold">{t("org.new")}</h2>
          <p className="text-sm text-muted">{t("org.newHint")}</p>
        </div>
        <OrgForm d={d} />
      </section>
    </div>
  );
}
