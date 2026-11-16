import Link from "next/link";
import { canEdit as canEditSection } from "@/lib/access";
import type { Prisma } from "@prisma/client";
import { getT } from "@/i18n";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/session";
import { orgScope, seesAllOrgs } from "@/lib/scope";
import { formatDate } from "@/lib/dates";
import { currentStage, tripNumber } from "@/lib/trips-core";

const FILTERS = ["active", "completed", "cancelled", "all"] as const;
type Filter = (typeof FILTERS)[number];

export default async function TripsPage({ searchParams }: { searchParams: Promise<{ f?: string; q?: string; org?: string }> }) {
  const user = await requireSection("trips");
  const sp = await searchParams;
  const t = await getT();
  const global = seesAllOrgs(user);
  const f: Filter = FILTERS.includes(sp.f as Filter) ? (sp.f as Filter) : "active";
  const q = sp.q?.trim();
  const num = q && /^(tsh-?)?\d+$/i.test(q) ? Number(q.replace(/\D/g, "")) : null;
  const where: Prisma.TripWhereInput = {
    ...orgScope(user, sp.org),
    ...(f === "all" ? {} : { status: f === "active" ? "ACTIVE" : f === "completed" ? "COMPLETED" : "CANCELLED" }),
    ...(q
      ? {
          OR: [
            ...(num ? [{ number: num }] : []),
            { routeFrom: { contains: q, mode: "insensitive" as const } },
            { routeTo: { contains: q, mode: "insensitive" as const } },
            { tractor: { plate: { contains: q.toUpperCase().replace(/[\s-]/g, "") } } },
            { driver: { fullName: { contains: q, mode: "insensitive" as const } } },
            { shipments: { some: { client: { name: { contains: q, mode: "insensitive" as const } } } } },
          ],
        }
      : {}),
  };
  const trips = await db.trip.findMany({
    where,
    orderBy: [{ loadDate: "desc" }, { number: "desc" }],
    take: 200,
    include: {
      org: { select: { name: true } },
      tractor: { select: { plate: true } },
      driver: { select: { fullName: true } },
      events: { select: { type: true, at: true } },
      shipments: { where: { status: "ACTIVE" }, select: { client: { select: { name: true } } } },
    },
  });
  const orgs = global ? await db.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) : [];
  const href = (nf: Filter) => `/trips?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.org ? { org: sp.org } : {}), f: nf })}`;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{t("trip.title")}</h1>
        <span className="flex-1" />
        {canEditSection(user, "trips") && <Link href="/trips/new" className="btn">+ {t("trip.new")}</Link>}
      </div>
      <div className="flex flex-wrap gap-2" role="tablist">
        {FILTERS.map((x) => (
          <Link key={x} href={href(x)} role="tab" aria-selected={f === x}
            className={`rounded-full px-4 py-2 text-sm ${f === x ? "bg-accent font-semibold text-on-accent" : "bg-paper hover:bg-accent-soft"}`}>
            {t(`trip.f.${x}`)}
          </Link>
        ))}
      </div>
      <form className="card flex flex-wrap items-center gap-2 p-3">
        <input type="hidden" name="f" value={f} />
        <input name="q" defaultValue={sp.q} placeholder={t("trip.search")} aria-label={t("common.search")} className="input w-auto min-w-0 flex-1 basis-48" />
        {global && (
          <select name="org" defaultValue={sp.org ?? ""} aria-label={t("common.org")} className="input w-auto">
            <option value="">{t("home.allOrgs")}</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
        <button className="btn-ghost">{t("common.search")}</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">{t("trip.number")}</th>
              <th className="px-4 py-2 font-medium">{t("trip.route")}</th>
              <th className="px-4 py-2 font-medium">{t("trip.tractor")}</th>
              <th className="px-4 py-2 font-medium">{t("trip.driver")}</th>
              <th className="px-4 py-2 font-medium">{t("trip.clients")}</th>
              <th className="px-4 py-2 font-medium">{t("trip.stage")}</th>
              {global && <th className="px-4 py-2 font-medium">{t("common.org")}</th>}
            </tr>
          </thead>
          <tbody>
            {trips.map((x) => {
              const done = Object.fromEntries(x.events.map((e) => [e.type, e.at]));
              const stage = currentStage(done);
              return (
                <tr key={x.id} className="border-t border-line align-top">
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <Link href={`/trips/${x.id}`} className="font-semibold text-accent hover:underline">{tripNumber(x.number)}</Link>
                    <div className="text-xs text-muted tabular-nums">{formatDate(x.loadDate)}</div>
                  </td>
                  <td className="px-4 py-2.5">{x.routeFrom} → {x.routeTo}{x.listOnly && <span className="ml-2 rounded-full border border-line px-2 py-0.5 text-xs text-muted">{t("trip.listOnlyShort")}</span>}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{x.tractor.plate}</td>
                  <td className="px-4 py-2.5">{x.driver.fullName}</td>
                  <td className="px-4 py-2.5">{x.shipments.map((s) => s.client.name).join(", ") || "—"}</td>
                  <td className="px-4 py-2.5">
                    {x.status === "CANCELLED" ? <span className="text-bad">{t("trip.cancelled")}</span>
                      : x.status === "COMPLETED" ? <span className="text-accent">{t("trip.completed")}</span>
                      : stage ? t(`trip.ev.${stage}`) : <span className="text-muted">{t("trip.waitingDriver")}</span>}
                  </td>
                  {global && <td className="px-4 py-2.5">{x.org.name}</td>}
                </tr>
              );
            })}
            {trips.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-muted">{t("common.none")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
