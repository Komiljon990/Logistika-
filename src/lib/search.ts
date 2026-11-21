/**
 * Global qidiruv (17.11.2026; 19.11.2026 dan sahifa va Telegram bot uchun umumiy): tashishlar (raqam, yo'nalish, yuk,
 * CMR), mijozlar (nom, STIR, telefon), haydovchilar, transport (davlat raqami), TIR/dazvol (raqam). Foydalanuvchi ko'ra
 * oladigan bo'limlardangina. "server-only" import qilinmaydi: bot instrumentation.ts dan ishga tushadi.
 */
import type { Dict } from "@/i18n/uz";
import { db } from "./db";
import { canView, type AccessUser } from "./access";
import { orgScope, type ScopeUser } from "./scope";
import { formatDate } from "./dates";
import { formatPhone } from "./phone";
import { tripNumber } from "./trips-core";

export type SearchUser = ScopeUser & AccessUser;
export type Hit = { href: string; title: string; sub?: string };
export type HitGroup = { key: "trips" | "clients" | "drivers" | "vehicles" | "permits"; title: string; hits: Hit[] };
type Tr = (key: keyof Dict) => string;

const PERMIT_HREF = { TIR: "/tir", DAZVOL: "/dazvol" } as const;

/** `take` — har guruhdan nechta (sahifada ko'proq, botda qisqa). Kamida 2 belgi bo'lmasa bo'sh ro'yxat. */
export async function globalSearch(user: SearchUser, raw: string, t: Tr, take = { trips: 30, other: 20 }): Promise<HitGroup[]> {
  const q = raw.trim().slice(0, 80);
  if (q.length < 2) return [];
  const scope = orgScope(user);
  const ci = { contains: q, mode: "insensitive" as const };
  const plateQ = q.toUpperCase().replace(/[\s-]/g, "");
  const digits = q.replace(/\D/g, "");
  const num = /^(TSH-?)?0*(\d{1,6})$/i.exec(q)?.[2];
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
          orderBy: { loadDate: "desc" }, take: take.trips,
          select: { id: true, number: true, routeFrom: true, routeTo: true, loadDate: true, tractor: { select: { plate: true } }, driver: { select: { fullName: true } } },
        })
      : [],
    canView(user, "clients")
      ? db.client.findMany({ where: { ...scope, OR: [{ name: ci }, { inn: { contains: q } }, { phone: { contains: digits || q } }] }, orderBy: { name: "asc" }, take: take.other, select: { id: true, name: true, inn: true, phone: true } })
      : [],
    canView(user, "drivers")
      ? db.driver.findMany({ where: { ...scope, OR: [{ fullName: ci }, { phone: { contains: digits || q } }] }, orderBy: { fullName: "asc" }, take: take.other, select: { id: true, fullName: true, phone: true, category: true } })
      : [],
    canView(user, "vehicles")
      ? db.vehicle.findMany({ where: { ...scope, OR: [{ plate: { contains: plateQ } }, { model: ci }] }, orderBy: { plate: "asc" }, take: take.other, select: { id: true, plate: true, model: true, type: true } })
      : [],
    canView(user, "tir") || canView(user, "dazvol")
      ? db.permit.findMany({
          where: { ...scope, number: { contains: q.toUpperCase() }, type: { in: [...(canView(user, "tir") ? ["TIR" as const] : []), ...(canView(user, "dazvol") ? ["DAZVOL" as const] : [])] } },
          orderBy: { number: "asc" }, take: take.other, select: { id: true, number: true, type: true, status: true },
        })
      : [],
  ]);
  return [
    { key: "trips", title: t("nav.trips"), hits: trips.map((x) => ({ href: `/trips/${x.id}`, title: `${tripNumber(x.number)} · ${x.routeFrom} → ${x.routeTo}`, sub: `${formatDate(x.loadDate)} · ${x.tractor.plate} · ${x.driver.fullName}` })) },
    { key: "clients", title: t("nav.clients"), hits: clients.map((x) => ({ href: `/clients/${x.id}`, title: x.name, sub: [x.inn ? `${t("org.inn")} ${x.inn}` : "", x.phone ? formatPhone(x.phone) : ""].filter(Boolean).join(" · ") })) },
    { key: "drivers", title: t("nav.drivers"), hits: drivers.map((x) => ({ href: `/drivers/${x.id}`, title: x.fullName, sub: [t(`drv.cat.${x.category}`), x.phone ? formatPhone(x.phone) : ""].filter(Boolean).join(" · ") })) },
    { key: "vehicles", title: t("nav.vehicles"), hits: vehicles.map((x) => ({ href: `/vehicles/${x.id}`, title: x.plate, sub: [t(`veh.type.${x.type}`), x.model ?? ""].filter(Boolean).join(" · ") })) },
    { key: "permits", title: t("nav.tir"), hits: permits.map((x) => ({ href: `${PERMIT_HREF[x.type]}/${x.id}`, title: x.number, sub: `${t(`tir.t.${x.type}`)} · ${t(`tir.s.${x.status}`)}` })) },
  ];
}
