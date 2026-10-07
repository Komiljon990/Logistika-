import { getT } from "@/i18n";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { isGlobalRole } from "@/lib/roles";
import { orgScope } from "@/lib/scope";

export default async function HomePage() {
  const user = await requireUser();
  const t = await getT();
  const userCount = await db.user.count({ where: { ...orgScope(user), status: "ACTIVE" } });
  const orgCount = isGlobalRole(user.role) ? await db.organization.count({ where: { status: "ACTIVE" } }) : null;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("home.title")}, {user.fullName}</h1>
        <p className="mt-1 text-muted">{user.orgName ?? t("home.allOrgs")}</p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        {orgCount !== null && <Kpi label={t("home.orgCount")} value={orgCount} />}
        <Kpi label={t("home.userCount")} value={userCount} />
      </div>
      <p className="text-sm text-muted">{t("home.next")}</p>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl tabular-nums">{value}</div>
    </div>
  );
}
