import Link from "next/link";
import { getT } from "@/i18n";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canView } from "@/lib/access";
import { orgScope } from "@/lib/scope";
import { formatDate } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";
import { tripNumber } from "@/lib/trips-core";
import { PERMIT_BASE } from "../tir/PermitsList";

type Hit = { href: string; title: string; sub?: string };

/**
 * Global qidiruv (17.11.2026): tashishlar (raqam, yo'nalish, yuk, CMR), mijozlar (nom, STIR, telefon), haydovchilar,
 * transport (davlat raqami), TIR/dazvol (raqam). Foydalanuvchi ko'ra oladigan bo'limlardangina.
 */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const t = await getT();
  const raw = ((await searchParams).q ?? "").trim().slice(0, 80);
  const scope = orgScope(user);
  const q = raw;
  const ci = { contains: q, mode: "insensitive" as const };
  const plateQ = q.toUpperCase().replace(/[\s-]/g, "");
  const num = /^(TSH-?)?0*(\d{1,6})$/i.exec(q)?.[2];
  const groups: { key: string; title: string; hits: Hit[] }[] = [];
  if (q.length >= 2) {
    const [trips, clients, drivers, vehicles, permits] = await Promise.all([
      canView(user, "trips")
        ? db.trip.findMany({
            where: {
              ...scope,
              OR: [
                ...(num ? [{ number: Number(num) }] : []),
                { routeFrom: ci }, { routeTo: ci }, { cargo: ci }, { note: ci },
                { shipments: { some: { OR: [{ smrNumber: ci }, { cargo: ci }, { client: { name: ci } }] } } },
                { tractor: { plate: { contains: plateQ } } },
                { driver: { fullName: ci } },
              ],
            },
            orderBy: { loadDate: "desc" }, take: 30,
            select: { id: true, number: true, routeFrom: true, routeTo: true, loadDate: true, tractor: { select: { plate: true } }, driver: { select: { fullName: true } } },
          })
        : [],
      canView(user, "clients")
        ? db.client.findMany({ where: { ...scope, OR: [{ name: ci }, { inn: { contains: q } }, { phone: { contains: q.replace(/\D/g, "") || q } }] }, orderBy: { name: "asc" }, take: 20, select: { id: true, name: true, inn: true, phone: true } })
        : [],
      canView(user, "drivers")
        ? db.driver.findMany({ where: { ...scope, OR: [{ fullName: ci }, { phone: { contains: q.replace(/\D/g, "") || q } }] }, orderBy: { fullName: "asc" }, take: 20, select: { id: true, fullName: true, phone: true, category: true } })
        : [],
      canView(user, "vehicles")
        ? db.vehicle.findMany({ where: { ...scope, OR: [{ plate: { contains: plateQ } }, { model: ci }] }, orderBy: { plate: "asc" }, take: 20, select: { id: true, plate: true, model: true, type: true } })
        : [],
      canView(user, "tir") || canView(user, "dazvol")
        ? db.permit.findMany({
            where: { ...scope, number: { contains: q.toUpperCase() }, type: { in: [...(canView(user, "tir") ? ["TIR" as const] : []), ...(canView(user, "dazvol") ? ["DAZVOL" as const] : [])] } },
            orderBy: { number: "asc" }, take: 20, select: { id: true, number: true, type: true, status: true },
          })
        : [],
    ]);
    groups.push(
      { key: "trips", title: t("nav.trips"), hits: trips.map((x) => ({ href: `/trips/${x.id}`, title: `${tripNumber(x.number)} · ${x.routeFrom} → ${x.routeTo}`, sub: `${formatDate(x.loadDate)} · ${x.tractor.plate} · ${x.driver.fullName}` })) },
      { key: "clients", title: t("nav.clients"), hits: clients.map((x) => ({ href: `/clients/${x.id}`, title: x.name, sub: [x.inn ? `${t("org.inn")} ${x.inn}` : "", x.phone ? formatPhone(x.phone) : ""].filter(Boolean).join(" · ") })) },
      { key: "drivers", title: t("nav.drivers"), hits: drivers.map((x) => ({ href: `/drivers/${x.id}`, title: x.fullName, sub: [t(`drv.cat.${x.category}`), x.phone ? formatPhone(x.phone) : ""].filter(Boolean).join(" · ") })) },
      { key: "vehicles", title: t("nav.vehicles"), hits: vehicles.map((x) => ({ href: `/vehicles/${x.id}`, title: x.plate, sub: [t(`veh.type.${x.type}`), x.model ?? ""].filter(Boolean).join(" · ") })) },
      { key: "permits", title: t("nav.tir"), hits: permits.map((x) => ({ href: `${PERMIT_BASE[x.type]}/${x.id}`, title: x.number, sub: `${t(`tir.t.${x.type}`)} · ${t(`tir.s.${x.status}`)}` })) },
    );
  }
  const total = groups.reduce((s, g) => s + g.hits.length, 0);
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold">{t("search.title")}</h1>
      <form action="/search" className="card flex flex-wrap items-center gap-2 p-3">
        <input name="q" defaultValue={raw} autoFocus placeholder={t("search.placeholder")} aria-label={t("common.search")} className="input w-auto min-w-0 flex-1 basis-56" />
        <button className="btn">{t("common.search")}</button>
      </form>
      {q.length > 0 && q.length < 2 && <p className="text-sm text-muted">{t("search.min")}</p>}
      {q.length >= 2 && total === 0 && <p className="card px-4 py-6 text-sm text-muted">{t("search.none")}</p>}
      {groups.filter((g) => g.hits.length).map((g) => (
        <section key={g.key} className="grid gap-2">
          <h2 className="text-lg font-semibold">{g.title} <span className="text-sm font-normal text-muted">({g.hits.length})</span></h2>
          <div className="card divide-y divide-line">
            {g.hits.map((h) => (
              <Link key={h.href} href={h.href} className="block px-4 py-2.5 text-sm hover:bg-ground">
                <span className="font-semibold text-accent">{h.title}</span>
                {h.sub && <span className="block text-xs text-muted">{h.sub}</span>}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
