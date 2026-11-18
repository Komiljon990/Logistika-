import Link from "next/link";
import { canEdit as canEditSection } from "@/lib/access";
import { notFound } from "next/navigation";
import { getDict, getT } from "@/i18n";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/session";
import { orgScope } from "@/lib/scope";
import { formatDate } from "@/lib/dates";
import { formatNumber } from "@/lib/currency-core";
import { activeCurrencies } from "@/lib/org-currency";
import { EVENT_ORDER, formatTashkent, nextEvents, tashkentNowInput, tripNumber } from "@/lib/trips-core";
import { Documents } from "../../Documents";
import { AddShipmentPanel, CancelTripButton, EventForm, ShipmentEditPanel, TripEditPanel } from "../forms";
import { CancelChargeButton, ChargeForm } from "../../settlements/forms";
import { payStatus, shipmentTotals } from "@/lib/settlement-core";
import { tashkentToday } from "@/lib/docs";
import { busyDriverIds, routePlaces } from "@/lib/trips";

const PAY_STYLE = { UNPAID: "bg-bad-soft text-bad", PARTIAL: "bg-warn-soft text-warn", PAID: "bg-accent-soft text-accent" } as const;

export default async function TripPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ docs?: string }> }) {
  const user = await requireSection("trips");
  const [{ id }, sp] = [await params, await searchParams];
  const [t, d] = [await getT(), await getDict()];
  const trip = await db.trip.findFirst({
    where: { id, ...orgScope(user) },
    include: {
      org: { select: { name: true } },
      tractor: { select: { id: true, plate: true } },
      trailer: { select: { id: true, plate: true } },
      driver: { select: { id: true, fullName: true, phone: true } },
      events: { orderBy: { at: "asc" } },
      shipments: {
        orderBy: { createdAt: "asc" },
        include: {
          client: { select: { id: true, name: true } },
          charges: { where: { status: "ACTIVE" }, orderBy: { date: "asc" } },
          allocations: { where: { payment: { status: "ACTIVE" } }, select: { applied: true } },
        },
      },
    },
  });
  if (!trip) notFound();
  const editor = canEditSection(user, "trips");
  const today = tashkentToday().toISOString().slice(0, 10);
  const done =Object.fromEntries(trip.events.map((e) => [e.type, e.at]));
  const allowed = trip.status === "CANCELLED" ? [] : nextEvents(done);
  const loaded = trip.status === "ACTIVE" && !done.UNLOADED;
  const userIds = [...new Set(trip.events.map((e) => e.userId).filter((x): x is string => !!x))];
  const users = userIds.length ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } }) : [];
  const userName = new Map(users.map((u) => [u.id, u.fullName]));
  const canChange = editor && trip.status !== "CANCELLED";
  // Tahrirlash uchun ro'yxatlar (joriy transport/haydovchi arxivlangan bo'lsa ham ro'yxatda qoladi).
  const busyDrivers = canChange && trip.status === "ACTIVE" ? await busyDriverIds(trip.orgId, db, trip.id) : new Set<string>();
  const [clients, currencies, tractors, trailers, allDrivers, places] = canChange
    ? await Promise.all([
        db.client.findMany({ where: { orgId: trip.orgId, OR: [{ status: "ACTIVE" }, { id: { in: trip.shipments.map((s) => s.clientId) } }] }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
        activeCurrencies(trip.orgId),
        db.vehicle.findMany({ where: { orgId: trip.orgId, type: "TRACTOR", OR: [{ status: "ACTIVE" }, { id: trip.tractorId }] }, orderBy: { plate: "asc" }, select: { id: true, plate: true, pairTrailerId: true, pairDriverId: true } }),
        db.vehicle.findMany({ where: { orgId: trip.orgId, type: "TRAILER", OR: [{ status: "ACTIVE" }, ...(trip.trailerId ? [{ id: trip.trailerId }] : [])] }, orderBy: { plate: "asc" }, select: { id: true, plate: true } }),
        db.driver.findMany({ where: { orgId: trip.orgId, OR: [{ status: "ACTIVE" }, { id: trip.driverId }] }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
        routePlaces(trip.orgId),
      ])
    : [[], [], [], [], [], []];
  // Boshqa yukli tashishdagi haydovchi tanlanmaydi (joriy haydovchi qoladi).
  const drivers = allDrivers.filter((x) => x.id === trip.driverId || !busyDrivers.has(x.id));
  const steps = EVENT_ORDER;
  // Reys xarajatlari va foyda (18.11.2026): kassadagi reysga bog'langan xarajatlar + haydovchiga reys haqi.
  const [costExpenses, costDriver] = await Promise.all([
    db.expense.findMany({ where: { tripId: trip.id, status: "ACTIVE" }, include: { account: { select: { currency: true } }, category: { include: { parent: true } } }, orderBy: { date: "asc" } }),
    db.driverEntry.findMany({ where: { tripId: trip.id, status: "ACTIVE", side: "STAFF", kind: "CHARGE" }, select: { id: true, amount: true, currency: true } }),
  ]);
  const costs = { expenses: costExpenses, driver: costDriver };
  const canCost = canEditSection(user, "cash");
  const profit: Record<string, number> = {};
  const addP = (cur: string, v: number) => { profit[cur] = Math.round(((profit[cur] ?? 0) + v) * 100) / 100; };
  for (const s of trip.shipments) if (s.status === "ACTIVE") addP(s.currency, Number(s.price) + s.charges.reduce((a, c) => a + Number(c.amount), 0));
  for (const e of costExpenses) addP(e.account.currency, -Number(e.amount));
  for (const e of costDriver) addP(e.currency, -Number(e.amount));

  return (
    <div className="grid gap-6">
      <Link href="/trips" className="text-sm text-accent hover:underline">← {t("trip.title")}</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{tripNumber(trip.number)} · {trip.routeFrom} → {trip.routeTo}</h1>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${
          trip.status === "CANCELLED" ? "bg-bad-soft text-bad" : trip.status === "COMPLETED" ? "bg-accent-soft text-accent" : loaded ? "bg-warn-soft text-warn" : "bg-accent-soft text-accent"
        }`}>
          {trip.status === "CANCELLED" ? t("trip.cancelled") : trip.status === "COMPLETED" ? t("trip.completed") : loaded ? t("trip.withCargo") : t("trip.unloadedReturning")}
        </span>
        {!user.orgId && <span className="text-sm text-muted">· {trip.org.name}</span>}
        <span className="flex-1" />
        {trip.listOnly && <span className="rounded-full border border-line px-3 py-1 text-sm text-muted">{t("trip.listOnlyShort")}</span>}
        {canChange && (
          <TripEditPanel
            d={d} tripId={trip.id}
            tractors={tractors.map((x) => ({ id: x.id, label: x.plate, pairTrailerId: x.pairTrailerId ?? "", pairDriverId: x.pairDriverId && drivers.some((r) => r.id === x.pairDriverId) ? x.pairDriverId : "" }))} places={places} trailers={trailers.map((x) => ({ id: x.id, label: x.plate }))} drivers={drivers.map((x) => ({ id: x.id, label: x.fullName }))}
            trip={{ routeFrom: trip.routeFrom, routeTo: trip.routeTo, loadDate: trip.loadDate.toISOString().slice(0, 10), cargo: trip.cargo ?? "", note: trip.note ?? "", tractorId: trip.tractorId, trailerId: trip.trailerId ?? "", driverId: trip.driverId, listOnly: trip.listOnly }}
          />
        )}
        {editor && trip.status === "ACTIVE" && <CancelTripButton d={d} tripId={trip.id} />}
      </div>
      {trip.note && <p className="text-sm text-muted">{t("common.note")}: {trip.note}</p>}

      <section className="card grid gap-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted">{t("trip.stagesHint")}</p>
          <span className="flex-1" />
          {editor && <EventForm d={d} tripId={trip.id} allowed={allowed} now={tashkentNowInput()} />}
        </div>
        <ol className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2 text-sm">
          {steps.map((s, i) => {
            const ev = trip.events.find((e) => e.type === s);
            const isNext = !ev && allowed.includes(s);
            return (
              <li key={s} className={`rounded-lg p-3 ${ev ? "bg-accent-soft text-accent" : isNext ? "border-2 border-accent" : "bg-ground text-muted"}`}>
                <div className="font-semibold">{i + 1}. {t(`trip.ev.${s}`)}</div>
                {ev ? (
                  <div className="mt-1 text-xs text-ink">
                    {formatTashkent(ev.at)}
                    <div className="text-muted">
                      {ev.source === "MANAGER" ? `${t("trip.byManager")}${ev.userId && userName.get(ev.userId) ? `: ${userName.get(ev.userId)}` : ""}` : t("trip.byDriver")}
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 text-xs">{isNext ? t("trip.waiting") : "—"}</div>
                )}
              </li>
            );
          })}
        </ol>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3 border-t border-line pt-4 text-sm">
          <div><div className="text-xs text-muted">{t("trip.tractor")}</div><Link href={`/vehicles/${trip.tractor.id}`} className="font-semibold text-accent hover:underline">{trip.tractor.plate}</Link></div>
          <div><div className="text-xs text-muted">{t("trip.trailer")}</div>{trip.trailer ? <Link href={`/vehicles/${trip.trailer.id}`} className="font-semibold text-accent hover:underline">{trip.trailer.plate}</Link> : "—"}</div>
          <div><div className="text-xs text-muted">{t("trip.driver")}</div><Link href={`/drivers/${trip.driver.id}`} className="font-semibold text-accent hover:underline">{trip.driver.fullName}</Link>{trip.driver.phone && <div className="text-xs tabular-nums">{trip.driver.phone}</div>}</div>
          <div><div className="text-xs text-muted">{t("trip.loadDate")}</div><div className="font-semibold tabular-nums">{formatDate(trip.loadDate)}</div></div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">{t("trip.shipments")}</h2>
        <span className="flex-1" />
      </div>
      {editor && loaded && <AddShipmentPanel d={d} tripId={trip.id} clients={clients.map((c) => ({ id: c.id, label: c.name }))} currencies={currencies} listOnly={trip.listOnly} />}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
        {trip.shipments.map((s, i) => (
          <section key={s.id} className={`card grid gap-3 p-5 ${s.status !== "ACTIVE" ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-xs text-muted">#{i + 1}</span>
              <Link href={`/clients/${s.client.id}`} className="text-base font-semibold text-accent hover:underline">{s.client.name}</Link>
            </div>
            {(s.contactName || s.contactPhone) && <div className="text-sm">{t("trip.contact")}: <span className="font-medium">{s.contactName}</span>{s.contactPhone && <> · <a href={`tel:${s.contactPhone}`} className="tabular-nums text-accent">{s.contactPhone}</a></>}</div>}
            <div className="flex flex-wrap gap-2 text-sm">
              {!trip.listOnly && <span className={`rounded-md px-2 py-1 font-medium ${s.terms === "CONTRACT" ? "bg-accent-soft text-accent" : "bg-warn-soft text-warn"}`}>{t(`trip.terms.${s.terms}`)}</span>}
              {s.smrNumber && <span className="rounded-md bg-ground px-2 py-1">CMR {s.smrNumber}</span>}
            </div>
            {s.cargo && <div className="text-sm text-muted">{s.cargo}</div>}
            {!trip.listOnly && (() => {
              const tot = shipmentTotals(Number(s.price), s.charges.map((c) => Number(c.amount)), s.allocations.map((a) => Number(a.applied)));
              const st = payStatus(tot.charged, tot.paid);
              return (
                <div className="grid gap-1.5 border-t border-line pt-3 text-sm tabular-nums">
                  <div className="flex justify-between"><span>{t("trip.price")}</span><span>{formatNumber(Number(s.price))} {s.currency}</span></div>
                  {s.charges.map((c) => (
                    <div key={c.id} className="flex items-baseline justify-between gap-2">
                      <span className="text-muted">
                        {t(`pay.c.${c.kind}`)}{c.kind === "DEMURRAGE" && c.days ? `: ${c.days} × ${formatNumber(Number(c.dailyAmount))}` : ""}{c.description ? ` — ${c.description}` : ""}
                        {editor && trip.status !== "CANCELLED" && <span className="ml-2"><CancelChargeButton d={d} chargeId={c.id} /></span>}
                      </span>
                      <span>+ {formatNumber(Number(c.amount))}</span>
                    </div>
                  ))}
                  <div className="flex justify-between"><span>{t("settle.paid")}</span><span>− {formatNumber(tot.paid)}</span></div>
                  <div className="flex items-baseline justify-between border-t border-line pt-2">
                    <span className="font-semibold">{t("pay.debt")}</span>
                    <span className={`text-xl font-bold ${tot.remaining > 0.005 ? "text-bad" : "text-accent"}`}>{formatNumber(tot.remaining)} {s.currency}</span>
                  </div>
                  <div><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PAY_STYLE[st]}`}>{t(`pay.s.${st}`)}</span></div>
                </div>
              );
            })()}
            {canChange && s.status === "ACTIVE" && (
              <ShipmentEditPanel
                d={d} shipmentId={s.id} listOnly={trip.listOnly} paid={s.allocations.length > 0} currencies={currencies}
                clients={clients.map((c) => ({ id: c.id, label: c.name }))}
                values={{
                  clientId: s.clientId, contactName: s.contactName, contactPhone: s.contactPhone, cargo: s.cargo ?? "", smrNumber: s.smrNumber ?? "",
                  terms: s.terms, price: String(Number(s.price)), currency: s.currency,
                  accountingPrice: s.accountingPrice != null ? String(Number(s.accountingPrice)) : "", accountingCurrency: s.accountingCurrency ?? "",
                }}
              />
            )}
            {editor && !trip.listOnly && s.status === "ACTIVE" && trip.status !== "CANCELLED" && (
              <div className="flex flex-wrap gap-2">
                <Link href={`/clients/${s.client.id}`} className="btn">+ {t("pay.receiveShort")}</Link>
                <ChargeForm d={d} shipmentId={s.id} currency={s.currency} today={today} />
              </div>
            )}
            {!trip.listOnly && s.accountingPrice != null && (
              <div className="rounded-md bg-ground px-3 py-2 text-xs text-muted">
                {t("trip.accountingPrice")}: <span className="font-semibold text-ink tabular-nums">{formatNumber(Number(s.accountingPrice))} {s.accountingCurrency}</span> — {t("trip.accountingShort")}
              </div>
            )}
          </section>
        ))}
      </div>

      {!trip.listOnly && (costs.expenses.length > 0 || costs.driver.length > 0 || canCost) && (
        <section className="card grid gap-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex-1 text-lg font-semibold">{t("trip.costs")}</h2>
            {canCost && trip.status !== "CANCELLED" && <Link href={`/cash/expenses?trip=${trip.id}`} className="btn-ghost">+ {t("cash.addExpense")}</Link>}
          </div>
          {costs.expenses.length + costs.driver.length === 0 ? (
            <p className="text-sm text-muted">{t("trip.costsNone")}</p>
          ) : (
            <div className="grid gap-1.5 text-sm tabular-nums">
              {costs.expenses.map((e) => (
                <div key={e.id} className="flex items-baseline justify-between gap-2">
                  <Link href={`/cash/expenses/${e.id}`} className="text-accent hover:underline">{e.category.parent ? `${e.category.parent.name} › ${e.category.name}` : e.category.name}{e.note ? ` — ${e.note}` : ""}</Link>
                  <span className="text-bad">− {formatNumber(Number(e.amount))} {e.account.currency}</span>
                </div>
              ))}
              {costs.driver.map((e) => (
                <div key={e.id} className="flex items-baseline justify-between gap-2">
                  <span>{t("ledger.t.TRIP")} — {trip.driver.fullName}</span>
                  <span className="text-bad">− {formatNumber(Number(e.amount))} {e.currency}</span>
                </div>
              ))}
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-line pt-2 font-semibold">
                <span>{t("rep.p.profit")}</span>
                <span className="grid justify-items-end">{Object.entries(profit).map(([cur, v]) => <span key={cur} className={v < 0 ? "text-bad" : "text-accent"}>{formatNumber(v)} {cur}</span>)}</span>
              </div>
            </div>
          )}
        </section>
      )}

      <Documents owner={{ kind: "trip", id: trip.id }} canEdit={editor && trip.status !== "CANCELLED"} showArchived={sp.docs === "all"} />
    </div>
  );
}
