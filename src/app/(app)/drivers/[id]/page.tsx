import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict, getT } from "@/i18n";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/roles";
import { orgScope } from "@/lib/scope";
import { StatusPill } from "@/components/StatusPill";
import { DriverForm } from "../../fleet-forms";
import { setDriverStatus } from "../../fleet-actions";
import { Documents } from "../../Documents";

export default async function DriverPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ docs?: string }> }) {
  const user = await requireUser();
  const [{ id }, sp] = [await params, await searchParams];
  const [t, d] = [await getT(), await getDict()];
  const x = await db.driver.findFirst({
    where: { id, ...orgScope(user) },
    include: { org: { select: { name: true } }, pairedVehicles: { where: { status: "ACTIVE" }, select: { id: true, plate: true } } },
  });
  if (!x) notFound();
  const editor = can(user.role, "data.edit");
  const canEdit = editor && x.status === "ACTIVE";
  const toggle = setDriverStatus.bind(null, x.id, x.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE");
  return (
    <div className="grid gap-6">
      <Link href="/drivers" className="text-sm text-accent hover:underline">← {t("drv.title")}</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{x.fullName}</h1>
        <span className="text-muted">{t(`drv.cat.${x.category}`)}</span>
        <StatusPill status={x.status} t={t} />
        {!user.orgId && <span className="text-sm text-muted">· {x.org.name}</span>}
        <span className="flex-1" />
        {editor && (
          <form action={toggle}>
            <button className={x.status === "ACTIVE" ? "btn-danger" : "btn-ghost"}>
              {x.status === "ACTIVE" ? t("common.archive") : t("common.restore")}
            </button>
          </form>
        )}
      </div>
      {!editor && <p className="text-sm text-muted">{t("common.viewOnly")}</p>}
      {x.pairedVehicles.length > 0 && (
        <p className="text-sm">
          {t("veh.title")}:{" "}
          {x.pairedVehicles.map((p, i) => (
            <span key={p.id}>{i > 0 && ", "}<Link href={`/vehicles/${p.id}`} className="text-accent hover:underline">{p.plate}</Link></span>
          ))}
        </p>
      )}
      <section className="card p-5">
        <DriverForm
          d={d}
          readOnly={!canEdit}
          driver={{ id: x.id, fullName: x.fullName, phone: x.phone ?? "", category: x.category, note: x.note ?? "" }}
        />
      </section>
      <Documents owner={{ kind: "driver", id: x.id }} canEdit={canEdit} showArchived={sp.docs === "all"} />
    </div>
  );
}
