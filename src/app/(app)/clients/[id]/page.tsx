import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict, getT } from "@/i18n";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/roles";
import { orgScope } from "@/lib/scope";
import { formatDate } from "@/lib/dates";
import { formatNumber } from "@/lib/currency-core";
import { tripNumber } from "@/lib/trips-core";
import { StatusPill } from "@/components/StatusPill";
import { ClientForm } from "../../trips/forms";
import { setClientStatus } from "../actions";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [t, d] = [await getT(), await getDict()];
  const c = await db.client.findFirst({ where: { id, ...orgScope(user) }, include: { org: { select: { name: true } } } });
  if (!c) notFound();
  const shipments = await db.shipment.findMany({
    where: { clientId: c.id, orgId: c.orgId },
    orderBy: { createdAt: "desc" },
    include: { trip: { select: { id: true, number: true, routeFrom: true, routeTo: true, status: true, loadDate: true, tractor: { select: { plate: true } } } } },
  });
  const editor = can(user.role, "data.edit");
  const toggle = setClientStatus.bind(null, c.id, c.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE");
  return (
    <div className="grid gap-6">
      <Link href="/clients" className="text-sm text-accent hover:underline">← {t("client.title")}</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{c.name}</h1>
        <StatusPill status={c.status} t={t} />
        {!user.orgId && <span className="text-sm text-muted">· {c.org.name}</span>}
        <span className="flex-1" />
        {editor && (
          <form action={toggle}>
            <button className={c.status === "ACTIVE" ? "btn-ghost" : "btn"}>{c.status === "ACTIVE" ? t("veh.deactivate") : t("common.restore")}</button>
          </form>
        )}
      </div>

      <section className="grid gap-2">
        <h2 className="text-lg font-semibold">{t("client.trips")}</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">{t("trip.number")}</th>
                <th className="px-4 py-2 font-medium">{t("trip.route")}</th>
                <th className="px-4 py-2 font-medium">{t("trip.tractor")}</th>
                <th className="px-4 py-2 font-medium">{t("trip.loadDate")}</th>
                <th className="px-4 py-2 font-medium">{t("trip.terms")}</th>
                <th className="px-4 py-2 text-right font-medium">{t("trip.price")}</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((s) => (
                <tr key={s.id} className={`border-t border-line ${s.trip.status === "CANCELLED" || s.status !== "ACTIVE" ? "text-muted line-through" : ""}`}>
                  <td className="whitespace-nowrap px-4 py-2.5"><Link href={`/trips/${s.trip.id}`} className="font-semibold text-accent hover:underline">{tripNumber(s.trip.number)}</Link></td>
                  <td className="px-4 py-2.5">{s.trip.routeFrom} → {s.trip.routeTo}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{s.trip.tractor.plate}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{formatDate(s.trip.loadDate)}</td>
                  <td className="px-4 py-2.5">{t(`trip.terms.${s.terms}`)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{formatNumber(Number(s.price))} {s.currency}</td>
                </tr>
              ))}
              {shipments.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-muted">{t("common.none")}</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted">{t("client.settlementSoon")}</p>
      </section>

      <h2 className="text-lg font-semibold">{t("common.details")}</h2>
      <section className="card p-5">
        <ClientForm
          d={d}
          readOnly={!editor || c.status !== "ACTIVE"}
          client={{ id: c.id, name: c.name, inn: c.inn ?? "", phone: c.phone ?? "", address: c.address ?? "", note: c.note ?? "" }}
        />
      </section>
    </div>
  );
}
