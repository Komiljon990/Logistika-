import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict, getT } from "@/i18n";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/roles";
import { orgScope } from "@/lib/scope";
import { toInputDate } from "@/lib/dates";
import { StatusPill } from "@/components/StatusPill";
import { VehicleForm } from "../../fleet-forms";
import { setVehicleStatus } from "../../fleet-actions";
import { Documents } from "../../Documents";

export default async function VehiclePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ docs?: string }> }) {
  const user = await requireUser();
  const [{ id }, sp] = [await params, await searchParams];
  const [t, d] = [await getT(), await getDict()];
  // Markaziy filtr: boshqa tashkilot transporti "topilmadi" bo'ladi.
  const v = await db.vehicle.findFirst({ where: { id, ...orgScope(user) }, include: { org: { select: { name: true } } } });
  if (!v) notFound();
  const canEdit = can(user.role, "data.edit") && v.status === "ACTIVE";
  const [trailers, drivers] = await Promise.all([
    db.vehicle.findMany({ where: { orgId: v.orgId, type: "TRAILER", status: "ACTIVE" }, orderBy: { plate: "asc" }, select: { id: true, plate: true } }),
    db.driver.findMany({ where: { orgId: v.orgId, status: "ACTIVE" }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
  ]);
  const toggle = setVehicleStatus.bind(null, v.id, v.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE");
  return (
    <div className="grid gap-6">
      <Link href="/vehicles" className="text-sm text-accent hover:underline">← {t("veh.title")}</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tabular-nums">{v.plate}</h1>
        <span className="text-muted">{t(`veh.type.${v.type}`)}</span>
        <StatusPill status={v.status} t={t} />
        {!user.orgId && <span className="text-sm text-muted">· {v.org.name}</span>}
        <span className="flex-1" />
        {can(user.role, "data.edit") && (
          <form action={toggle}>
            <button className={v.status === "ACTIVE" ? "btn-danger" : "btn-ghost"}>
              {v.status === "ACTIVE" ? t("common.archive") : t("common.restore")}
            </button>
          </form>
        )}
      </div>
      {!can(user.role, "data.edit") && <p className="text-sm text-muted">{t("common.viewOnly")}</p>}
      <section className="card p-5">
        <VehicleForm
          d={d}
          readOnly={!canEdit}
          trailers={trailers.map((x) => ({ id: x.id, label: x.plate }))}
          drivers={drivers.map((x) => ({ id: x.id, label: x.fullName }))}
          vehicle={{
            id: v.id, plate: v.plate, model: v.model ?? "", type: v.type, ownership: v.ownership,
            leaseOwner: v.leaseOwner ?? "", leaseStart: toInputDate(v.leaseStart), leaseEnd: toInputDate(v.leaseEnd),
            note: v.note ?? "", pairTrailerId: v.pairTrailerId ?? "", pairDriverId: v.pairDriverId ?? "",
          }}
        />
      </section>
      <Documents owner={{ kind: "vehicle", id: v.id }} canEdit={canEdit} showArchived={sp.docs === "all"} />
    </div>
  );
}
