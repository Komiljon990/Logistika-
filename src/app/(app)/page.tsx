import Link from "next/link";
import { getT } from "@/i18n";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { isGlobalRole } from "@/lib/roles";
import { orgScope } from "@/lib/scope";
import { formatDate } from "@/lib/dates";
import { tashkentToday } from "@/lib/docs";
import { ExpiryPill } from "@/components/ExpiryPill";

export default async function HomePage() {
  const user = await requireUser();
  const t = await getT();
  const scope = orgScope(user);
  const today = tashkentToday();
  const in30 = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 30));
  const expiringWhere = {
    ...scope,
    status: "ACTIVE" as const,
    expiresAt: { not: null, lte: in30 },
    OR: [{ vehicle: { status: "ACTIVE" as const } }, { driver: { status: "ACTIVE" as const } }],
  };
  const [vehicles, drivers, expiringCount, expiring, orgCount] = await Promise.all([
    db.vehicle.count({ where: { ...scope, status: "ACTIVE" } }),
    db.driver.count({ where: { ...scope, status: "ACTIVE" } }),
    db.document.count({ where: expiringWhere }),
    db.document.findMany({
      where: expiringWhere,
      orderBy: { expiresAt: "asc" },
      take: 10,
      include: { vehicle: { select: { id: true, plate: true } }, driver: { select: { id: true, fullName: true } } },
    }),
    isGlobalRole(user.role) ? db.organization.count({ where: { status: "ACTIVE" } }) : Promise.resolve(null),
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("home.title")}, {user.fullName}</h1>
        <p className="mt-1 text-muted">{user.orgName ?? t("home.allOrgs")}</p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        {orgCount !== null && <Kpi label={t("home.orgCount")} value={orgCount} />}
        <Kpi label={t("home.vehicles")} value={vehicles} href="/vehicles" />
        <Kpi label={t("home.drivers")} value={drivers} href="/drivers" />
        <Kpi label={t("home.expiring")} value={expiringCount} warn={expiringCount > 0} />
      </div>
      {expiring.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">{t("home.expiringList")}</h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {expiring.map((x) => {
                  const href = x.vehicle ? `/vehicles/${x.vehicle.id}` : `/drivers/${x.driver!.id}`;
                  return (
                    <tr key={x.id} className="border-t border-line first:border-t-0">
                      <td className="px-4 py-2.5"><Link href={href} className="text-accent hover:underline">{x.vehicle?.plate ?? x.driver?.fullName}</Link></td>
                      <td className="px-4 py-2.5">{t(`doc.t.${x.type}`)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{formatDate(x.expiresAt)}</td>
                      <td className="px-4 py-2.5"><ExpiryPill expiresAt={x.expiresAt} t={t} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Kpi({ label, value, href, warn }: { label: string; value: number; href?: string; warn?: boolean }) {
  const body = (
    <div className={`card px-4 py-3 ${warn ? "border-warn bg-warn-soft" : ""}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl tabular-nums">{value}</div>
    </div>
  );
  return href ? <Link href={href} className="hover:opacity-90">{body}</Link> : body;
}
