import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { can, type Permission } from "./roles";
import type { CurrentUser } from "./session";
import { formatNumber } from "./currency-core";
import { tripNumber } from "./trips-core";

import { activityWhere, UNDOABLE } from "./activity-core";

export { activityWhere, UNDOABLE };

/*
 * "Oxirgi amallar": audit jurnalidan. O'chirish faqat yaratish amallari uchun va faqat o'sha yozuvga huquqi bo'lsa
 * (bekor qilish — tarix saqlanadi).
 */

export type ActivityRow = {
  id: string; at: Date; action: string; actorName: string | null;
  text: string; href: string | null; active: boolean | null; canUndo: boolean;
};

type Info = { text: string; href: string | null; active: boolean | null };

const money = (v: Prisma.Decimal | number, cur: string) => `${formatNumber(Number(v))} ${cur}`;

export async function loadActivity(user: CurrentUser, mineOnly: boolean, docLabel: (type: string, title: string | null) => string): Promise<ActivityRow[]> {
  const logs = await db.auditLog.findMany({ where: activityWhere(user, mineOnly), orderBy: { at: "desc" }, take: 150 });
  const ids = (entity: string) => [...new Set(logs.filter((l) => l.entity === entity).map((l) => l.entityId))];
  const [payments, charges, trips, shipments, clients, vehicles, drivers, docs, expenses, transfers, accounts, cats, users, actors] = await Promise.all([
    db.payment.findMany({ where: { id: { in: ids("Payment") } }, include: { client: { select: { name: true } } } }),
    db.shipmentCharge.findMany({ where: { id: { in: ids("ShipmentCharge") } }, include: { shipment: { select: { currency: true, tripId: true, trip: { select: { number: true } } } } } }),
    db.trip.findMany({ where: { id: { in: ids("Trip") } }, select: { id: true, number: true, routeFrom: true, routeTo: true, status: true } }),
    db.shipment.findMany({ where: { id: { in: ids("Shipment") } }, include: { client: { select: { name: true } }, trip: { select: { number: true } } } }),
    db.client.findMany({ where: { id: { in: ids("Client") } }, select: { id: true, name: true, status: true } }),
    db.vehicle.findMany({ where: { id: { in: ids("Vehicle") } }, select: { id: true, plate: true, status: true } }),
    db.driver.findMany({ where: { id: { in: ids("Driver") } }, select: { id: true, fullName: true, status: true } }),
    db.document.findMany({ where: { id: { in: ids("Document") } }, select: { id: true, type: true, title: true, status: true, vehicleId: true, driverId: true, tripId: true } }),
    db.expense.findMany({ where: { id: { in: ids("Expense") } }, include: { account: { select: { currency: true } }, category: { select: { name: true, parent: { select: { name: true } } } } } }),
    db.cashTransfer.findMany({ where: { id: { in: ids("CashTransfer") } }, include: { fromAccount: { select: { name: true, currency: true } }, toAccount: { select: { name: true } } } }),
    db.cashAccount.findMany({ where: { id: { in: ids("CashAccount") } }, select: { id: true, name: true, currency: true, status: true } }),
    db.expenseCategory.findMany({ where: { id: { in: ids("ExpenseCategory") } }, select: { id: true, name: true } }),
    db.user.findMany({ where: { id: { in: ids("User") } }, select: { id: true, fullName: true } }),
    db.user.findMany({ where: { id: { in: [...new Set(logs.map((l) => l.actorId).filter((x): x is string => !!x))] } }, select: { id: true, fullName: true } }),
  ]);

  const info = new Map<string, Info>();
  const put = (entity: string, id: string, i: Info) => info.set(`${entity}:${id}`, i);
  for (const p of payments) put("Payment", p.id, { text: `${p.client.name} · ${money(p.amount, p.currency)}`, href: `/clients/${p.clientId}`, active: p.status === "ACTIVE" });
  for (const c of charges) put("ShipmentCharge", c.id, { text: `${tripNumber(c.shipment.trip.number)} · ${money(c.amount, c.shipment.currency)}`, href: `/trips/${c.shipment.tripId}`, active: c.status === "ACTIVE" });
  for (const t of trips) put("Trip", t.id, { text: `${tripNumber(t.number)} · ${t.routeFrom} → ${t.routeTo}`, href: `/trips/${t.id}`, active: t.status !== "CANCELLED" });
  for (const s of shipments) put("Shipment", s.id, { text: `${tripNumber(s.trip.number)} · ${s.client.name} · ${money(s.price, s.currency)}`, href: `/trips/${s.tripId}`, active: s.status === "ACTIVE" });
  for (const c of clients) put("Client", c.id, { text: c.name, href: `/clients/${c.id}`, active: c.status === "ACTIVE" });
  for (const v of vehicles) put("Vehicle", v.id, { text: v.plate, href: `/vehicles/${v.id}`, active: v.status === "ACTIVE" });
  for (const d of drivers) put("Driver", d.id, { text: d.fullName, href: `/drivers/${d.id}`, active: d.status === "ACTIVE" });
  for (const d of docs) {
    const href = d.vehicleId ? `/vehicles/${d.vehicleId}` : d.driverId ? `/drivers/${d.driverId}` : d.tripId ? `/trips/${d.tripId}` : "/org-docs";
    put("Document", d.id, { text: docLabel(d.type, d.title), href, active: d.status === "ACTIVE" });
  }
  for (const e of expenses) {
    const cat = e.category.parent ? `${e.category.parent.name} › ${e.category.name}` : e.category.name;
    put("Expense", e.id, { text: `${cat} · ${money(e.amount, e.account.currency)}`, href: `/cash/expenses/${e.id}`, active: e.status === "ACTIVE" });
  }
  for (const t of transfers) put("CashTransfer", t.id, { text: `${t.fromAccount.name} → ${t.toAccount.name} · ${money(t.amount, t.fromAccount.currency)}`, href: "/cash/transfers", active: t.status === "ACTIVE" });
  for (const a of accounts) put("CashAccount", a.id, { text: `${a.name} · ${a.currency}`, href: `/cash/accounts/${a.id}`, active: a.status === "ACTIVE" });
  for (const c of cats) put("ExpenseCategory", c.id, { text: c.name, href: "/settings/cash", active: null });
  for (const u of users) put("User", u.id, { text: u.fullName, href: null, active: null });
  const actorName = new Map(actors.map((a) => [a.id, a.fullName]));

  return logs.map((l) => {
    const i = info.get(`${l.entity}:${l.entityId}`);
    const details = (l.details ?? {}) as Record<string, unknown>;
    // O'chirilgan transport: nomi audit tafsilotidan.
    const fallback = l.entity === "OrgCurrency" ? l.entityId : typeof details.plate === "string" ? details.plate : typeof details.fullName === "string" ? details.fullName : "";
    let perm: Permission | undefined = UNDOABLE[l.action as keyof typeof UNDOABLE];
    // Hujjat: tashkilot hujjati — orgdoc.edit, transport/haydovchi/tashish hujjati — data.edit.
    if (l.entity === "Document" && perm) perm = i?.href === "/org-docs" ? "orgdoc.edit" : "data.edit";
    return {
      id: l.id, at: l.at, action: l.action, actorName: l.actorId ? actorName.get(l.actorId) ?? null : null,
      text: i?.text ?? fallback, href: i?.href ?? (l.entity === "OrgCurrency" ? "/currencies" : null), active: i?.active ?? null,
      canUndo: !!perm && i?.active === true && l.actorId !== null && can(user.role, perm) && !user.readOnly,
    };
  });
}
