import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict, getT } from "@/i18n";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/session";
import { canEdit as canEditSection } from "@/lib/access";
import { orgScope } from "@/lib/scope";
import { formatNumber } from "@/lib/currency-core";
import { formatDate } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";
import { tashkentToday } from "@/lib/docs";
import { activeCurrencies } from "@/lib/org-currency";
import { cashEnabled, loadAccounts } from "@/lib/cash";
import { lessorBalances, lessorStatement, monthOptions } from "@/lib/lessors-core";
import { PrintButton } from "@/components/PrintButton";
import { ExcelButton } from "@/components/ExcelButton";
import { AttachVehicleForm, CancelEntryButton, DetachVehicleButton, LedgerButtons } from "./forms";

const tripNo = (n: number) => `TSH-${String(n).padStart(4, "0")}`;
const monthLabel = (m: string) => `${m.slice(5, 7)}.${m.slice(0, 4)}`;

/**
 * Haydovchi hisob-kitobi sahifasi: qarz (valyuta bo'yicha), "+ Hisob qo'shish" va "+ To'lov", ko'chirma.
 * LESSOR — ijarachi (u bizga qarz), STAFF — xodim haydovchi (biz unga qarz).
 */
export async function LedgerView({ user, driverId, side }: { user: CurrentUser; driverId: string; side: "LESSOR" | "STAFF" }) {
  const [t, d] = [await getT(), await getDict()];
  const dr = await db.driver.findFirst({
    where: { id: driverId, ...orgScope(user) },
    include: {
      entries: { where: { side, status: "ACTIVE" }, include: { account: { select: { name: true } }, trip: { select: { id: true, number: true, routeFrom: true, routeTo: true } } } },
      ownedVehicles: { where: { status: "ACTIVE" }, select: { id: true, plate: true, model: true, type: true } },
      pairedVehicles: { where: { status: "ACTIVE" }, select: { id: true, plate: true } },
    },
  });
  if (!dr) notFound();
  const section = side === "LESSOR" ? "lessors" : "settlements";
  const back = side === "LESSOR" ? "/lessors" : "/settlements/drivers";
  const canEdit = canEditSection(user, section) && dr.status === "ACTIVE";
  const entries = dr.entries.map((e) => ({ ...e, amount: Number(e.amount) }));
  const bal = lessorBalances(entries);
  const rows = lessorStatement(entries).reverse();
  const today = tashkentToday().toISOString().slice(0, 10);
  const vehicles = side === "LESSOR" ? dr.ownedVehicles : dr.pairedVehicles;
  const [currencies, accounts, freeVehicles, trips] = canEdit
    ? await Promise.all([
        activeCurrencies(dr.orgId),
        (await cashEnabled(dr.orgId)) ? loadAccounts(dr.orgId) : Promise.resolve([]),
        side === "LESSOR"
          ? db.vehicle.findMany({ where: { orgId: dr.orgId, status: "ACTIVE", ownerDriverId: null }, orderBy: { plate: "asc" }, select: { id: true, plate: true, type: true } })
          : Promise.resolve([]),
        side === "STAFF"
          ? db.trip.findMany({ where: { orgId: dr.orgId, driverId: dr.id, status: { not: "CANCELLED" } }, orderBy: { loadDate: "desc" }, take: 60, select: { id: true, number: true, routeFrom: true, routeTo: true, loadDate: true } })
          : Promise.resolve([]),
      ])
    : [[], [], [], []];
  const charged = new Set(dr.entries.filter((e) => e.type === "TRIP" && e.tripId).map((e) => e.tripId));
  const debtLabel = side === "LESSOR" ? t("lessor.debt") : t("ledger.weOwe");

  return (
    <div className="grid max-w-4xl gap-6">
      <Link href={back} className="text-sm text-accent hover:underline print:hidden">← {side === "LESSOR" ? t("lessor.title") : t("ledger.driversTitle")}</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{dr.fullName}</h1>
        {dr.phone && <span className="tabular-nums text-muted">{formatPhone(dr.phone)}</span>}
        {dr.status !== "ACTIVE" && <span className="rounded-full bg-ground px-2 py-0.5 text-xs font-semibold text-muted">{t(`status.${dr.status}`)}</span>}
        <span className="flex-1" />
        <Link href={`/drivers/${dr.id}`} className="btn-ghost print:hidden">{t("ledger.driverCard")}</Link>
        <PrintButton label={t("common.print")} />
      </div>

      <section className="card grid gap-2 p-4">
        <h2 className="font-semibold">{side === "LESSOR" ? t("lessor.vehicles") : t("ledger.pairVehicles")}</h2>
        <div className="flex flex-wrap gap-2">
          {vehicles.map((v) => (
            <span key={v.id} className="inline-flex items-center gap-2 rounded-lg border border-line px-2.5 py-1 text-sm">
              <Link href={`/vehicles/${v.id}`} className="font-semibold text-accent hover:underline">{v.plate}</Link>
              {"model" in v && typeof v.model === "string" && v.model && <span className="text-xs text-muted">{v.model}</span>}
              {side === "LESSOR" && canEdit && <span className="print:hidden"><DetachVehicleButton d={d} vehicleId={v.id} /></span>}
            </span>
          ))}
          {vehicles.length === 0 && <span className="text-sm text-muted">{t("lessor.noVehicles")}</span>}
        </div>
        {side === "LESSOR" && canEdit && (
          <div className="print:hidden">
            <AttachVehicleForm d={d} driverId={dr.id} vehicles={freeVehicles.map((v) => ({ id: v.id, label: `${v.plate} · ${t(`veh.type.${v.type}`)}` }))} />
            <p className="mt-1 text-xs text-muted">{t("lessor.attachHint")} <Link href="/vehicles" className="text-accent hover:underline">{t("lessor.addVehicleLink")}</Link></p>
          </div>
        )}
      </section>

      <section className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        {Object.keys(bal).length === 0 && <p className="card p-4 text-sm text-muted">{t("lessor.noEntries")}</p>}
        {Object.entries(bal).map(([cur, b]) => (
          <div key={cur} className="card grid gap-1 p-4 text-sm">
            <div className="text-xs text-muted">{debtLabel}, {cur}</div>
            <div className={`text-2xl font-bold tabular-nums ${b.debt > 0 ? "text-bad" : b.debt < 0 ? "text-accent" : ""}`}>{formatNumber(b.debt)}</div>
            <div className="text-xs text-muted tabular-nums">{t("lessor.charged")}: {formatNumber(b.charged)} · {t("settle.paid")}: {formatNumber(b.paid)}</div>
          </div>
        ))}
      </section>

      {canEdit && (
        <div className="print:hidden">
          <LedgerButtons
            d={d} driverId={dr.id} side={side} currencies={currencies} today={today} months={monthOptions(today)}
            accounts={accounts.map((a) => ({ id: a.id, label: a.label, currency: a.currency }))}
            vehicles={vehicles.map((v) => ({ id: v.id, label: v.plate }))}
            trips={trips.map((x) => ({ id: x.id, label: `${tripNo(x.number)} · ${x.routeFrom} → ${x.routeTo} · ${formatDate(x.loadDate)}${charged.has(x.id) ? ` ✓ ${t("ledger.tripCharged")}` : ""}` }))}
          />
        </div>
      )}

      <section className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex-1 text-lg font-semibold">{t("lessor.statement")}</h2>
          <ExcelButton label={t("common.excel")} target="ledger" file={`${dr.fullName} ${today}`} />
        </div>
        <div className="card overflow-x-auto">
          <table id="ledger" className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">{t("pay.date")}</th>
                <th className="px-3 py-2 font-medium">{t("cash.operation")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("lessor.charged")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("settle.paid")}</th>
                <th className="px-3 py-2 text-right font-medium">{debtLabel}</th>
                {canEdit && <th className="px-3 py-2 print:hidden" data-noexport />}
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-t border-line align-top">
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatDate(e.date)}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium">
                      {e.kind === "CHARGE" ? t(`ledger.t.${e.type ?? "OTHER"}`) : t("lessor.kind.PAYMENT")}
                      {e.period ? ` · ${monthLabel(e.period)}` : ""}
                    </span>
                    {e.trip && <> · <Link href={`/trips/${e.trip.id}`} className="text-accent hover:underline">{tripNo(e.trip.number)} {e.trip.routeFrom} → {e.trip.routeTo}</Link></>}
                    {(e.plate || e.account || e.note) && <div className="text-xs text-muted">{[e.plate, e.account?.name, e.note].filter(Boolean).join(" · ")}</div>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-warn">{e.kind === "CHARGE" ? `${formatNumber(e.amount)} ${e.currency}` : ""}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-accent">{e.kind === "PAYMENT" ? `${formatNumber(e.amount)} ${e.currency}` : ""}</td>
                  <td className={`whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums ${e.debt > 0 ? "text-bad" : ""}`}>{formatNumber(e.debt)} {e.currency}</td>
                  {canEdit && <td className="px-3 py-2 text-right print:hidden" data-noexport><CancelEntryButton d={d} id={e.id} /></td>}
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-5 text-muted">{t("common.none")}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
