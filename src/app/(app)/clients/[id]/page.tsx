import Link from "next/link";
import { ExcelButton } from "@/components/ExcelButton";
import { canEdit as canEditSection } from "@/lib/access";
import { notFound } from "next/navigation";
import { getDict, getT } from "@/i18n";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/session";
import { orgScope } from "@/lib/scope";
import { formatDate } from "@/lib/dates";
import { tashkentToday } from "@/lib/docs";
import { formatNumber, rateDigits } from "@/lib/currency-core";
import { tripNumber } from "@/lib/trips-core";
import { activeCurrencies } from "@/lib/org-currency";
import { ensureRates, rateMap } from "@/lib/rates";
import { balancesByClient, loadLedger } from "@/lib/settlement";
import { StatusPill } from "@/components/StatusPill";
import { ClientForm } from "../../trips/forms";
import { AdvanceForm, CancelPaymentButton, HandOverButton, PaymentAccountForm, PaymentForm, type OpenRow, type PayAccounts } from "../../settlements/forms";
import { paymentAccounts } from "@/lib/cash";
import { accountKindFor } from "@/lib/cash-core";
import { setClientStatus } from "../actions";

const PAY_STYLE = { UNPAID: "bg-bad-soft text-bad", PARTIAL: "bg-warn-soft text-warn", PAID: "bg-accent-soft text-accent" } as const;

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSection("clients");
  const { id } = await params;
  const [t, d] = [await getT(), await getDict()];
  const c = await db.client.findFirst({ where: { id, ...orgScope(user) }, include: { org: { select: { name: true } } } });
  if (!c) notFound();
  const today = tashkentToday().toISOString().slice(0, 10);
  const editor = canEditSection(user, "clients");
  const { shipments, payments } = await loadLedger({ orgId: c.orgId, clientId: c.id });
  const balance = balancesByClient(shipments, payments).get(c.id) ?? {};
  const cancelledShipments = await db.shipment.findMany({
    where: { clientId: c.id, orgId: c.orgId, OR: [{ status: { not: "ACTIVE" } }, { trip: { status: "CANCELLED" } }] },
    include: { trip: { select: { id: true, number: true, routeFrom: true, routeTo: true, tractor: { select: { plate: true } } } } },
  });
  const accounts: PayAccounts = editor ? await paymentAccounts(c.orgId) : { options: [], required: false };
  let formData: { currencies: string[]; drivers: { id: string; label: string }[]; rates: Record<string, number> } | null = null;
  if (editor && c.status === "ACTIVE") {
    await ensureRates([today], today);
    const [currencies, drivers, rates] = await Promise.all([
      activeCurrencies(c.orgId),
      db.driver.findMany({ where: { orgId: c.orgId, status: "ACTIVE" }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
      rateMap(today),
    ]);
    formData = { currencies, drivers: drivers.map((x) => ({ id: x.id, label: x.fullName })), rates };
  }
  const open: OpenRow[] = shipments.map((s) => ({
    id: s.id, label: tripNumber(s.tripNumber), sub: `${s.routeFrom} → ${s.routeTo} · ${s.plate}`,
    currency: s.currency, remaining: s.remaining, terms: s.terms, order: s.order,
  }));
  const toggle = setClientStatus.bind(null, c.id, c.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE");
  const balances = Object.entries(balance);

  return (
    <div className="grid gap-6">
      <Link href="/settlements" className="text-sm text-accent hover:underline">← {t("settle.title")}</Link>
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

      {balances.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
          {balances.map(([cur, b]) => (
            <div key={cur} className="card p-4">
              <div className="text-xs text-muted">{t("settle.debtCol")}, {cur}</div>
              <div className={`mt-1 text-2xl font-bold tabular-nums ${b.debt > 0.005 ? "text-bad" : b.debt < -0.005 ? "text-accent" : ""}`}>{formatNumber(b.debt)}</div>
              <div className="mt-1 text-xs text-muted tabular-nums">
                {t("settle.charged")} {formatNumber(b.charged)} · {t("settle.paid")} {formatNumber(b.paid)}{b.advance > 0 ? ` · ${t("settle.advance")} ${formatNumber(b.advance)}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-start gap-6">
        <div className="grid min-w-0 flex-[999_1_560px] gap-6">
          <section className="grid gap-2">
            <h2 className="text-lg font-semibold">{t("client.trips")}</h2>
            <div className="card overflow-x-auto">
              <div className="flex justify-end border-b border-line px-3 py-1 print:hidden"><ExcelButton label={t("common.excel")} target="xl-clients-id-page" file={t("nav.clients")} /></div>
              <table id="xl-clients-id-page" className="w-full text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr>
                    <th className="px-4 py-2 font-medium">{t("trip.number")} · {t("trip.route")} · {t("trip.tractor")}</th>
                    <th className="px-4 py-2 text-right font-medium">{t("settle.charged")}</th>
                    <th className="px-4 py-2 text-right font-medium">{t("settle.paid")}</th>
                    <th className="px-4 py-2 text-right font-medium">{t("pay.debt")}</th>
                    <th className="px-4 py-2 font-medium">{t("common.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {shipments.map((s) => (
                    <tr key={s.id} className="border-t border-line align-top">
                      <td className="px-4 py-2.5">
                        <Link href={`/trips/${s.tripId}`} className="font-semibold text-accent hover:underline">{tripNumber(s.tripNumber)}</Link> · {s.routeFrom} → {s.routeTo}
                        <div className="text-xs text-muted">{t("trip.tractor")} {s.plate} · {formatDate(s.loadDate)} · {t(`trip.terms.${s.terms}`)}</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{formatNumber(s.charged)} {s.currency}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{formatNumber(s.paid)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums">{formatNumber(s.remaining)}</td>
                      <td className="px-4 py-2.5"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${PAY_STYLE[s.status]}`}>{t(`pay.s.${s.status}`)}</span></td>
                    </tr>
                  ))}
                  {cancelledShipments.map((s) => (
                    <tr key={s.id} className="border-t border-line text-muted">
                      <td className="px-4 py-2.5 line-through" colSpan={4}>{tripNumber(s.trip.number)} · {s.trip.routeFrom} → {s.trip.routeTo} · {s.trip.tractor.plate}</td>
                      <td className="px-4 py-2.5 text-xs">{t("trip.cancelled")}</td>
                    </tr>
                  ))}
                  {shipments.length + cancelledShipments.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-muted">{t("common.none")}</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-2">
            <h2 className="text-lg font-semibold">{t("pay.title")}</h2>
            <div className="card divide-y divide-line">
              {payments.map((p) => (
                <div key={p.id} className={`grid gap-2 p-4 text-sm ${p.active ? "" : "opacity-60"}`}>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="tabular-nums">{formatDate(p.date)}</span>
                    <span className="font-semibold">{t(`pay.m.${p.method}`)}{p.receivedBy ? ` · ${p.receivedBy === "DRIVER" ? `${t("pay.r.DRIVER")}: ${p.driverName}` : t("pay.r.OFFICE")}` : ""}</span>
                    <span className="flex-1" />
                    <span className={`text-base font-bold tabular-nums ${p.active ? "" : "line-through"}`}>{formatNumber(p.amount)} {p.currency}</span>
                  </div>
                  {p.note && <div className="text-muted">{p.note}</div>}
                  {p.active && (p.receivedBy !== "DRIVER" || p.handedOverAt) && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>{t("pay.account")}: {p.accountLabel ? <strong>{p.accountLabel}</strong> : <span className="text-muted">{t("pay.accountNone")}</span>}</span>
                      {editor && <PaymentAccountForm d={d} paymentId={p.id} kind={p.receivedBy === "DRIVER" ? "CASH" : accountKindFor(p.method, p.receivedBy)!} currency={p.currency} current={p.accountId} accounts={accounts} />}
                    </div>
                  )}
                  {p.allocations.length > 0 && (
                    <ul className="grid gap-0.5 text-muted">
                      {p.allocations.map((a, i) => (
                        <li key={i}>
                          {tripNumber(a.tripNumber)}: {formatNumber(a.applied)} {a.currency}
                          {a.currency !== p.currency && ` (${t("calc.rate")} 1 ${a.currency} = ${formatNumber(a.rate, rateDigits(a.rate))} ${p.currency}${a.rateManual ? `, ${t("pay.manualRate")}` : `, ${t("pay.cbuRate")}`})`}
                        </li>
                      ))}
                    </ul>
                  )}
                  {!p.active && <div className="text-bad">{t("pay.cancelled")}</div>}
                  {p.active && p.receivedBy === "DRIVER" && (
                    <div className="text-warn">{p.handedOverAt ? `${t("pay.handedOver")}: ${formatDate(p.handedOverAt)}` : t("pay.atDriver")}</div>
                  )}
                  {p.active && (
                    <div className="flex flex-wrap items-center gap-3">
                      {p.advance > 0.005 && <span className="font-semibold text-accent">{t("settle.advance")}: {formatNumber(p.advance)} {p.currency}</span>}
                      <span className="flex-1" />
                      {editor && p.receivedBy === "DRIVER" && !p.handedOverAt && <HandOverButton d={d} paymentId={p.id} currency={p.currency} accounts={accounts} />}
                      {editor && <CancelPaymentButton d={d} paymentId={p.id} />}
                    </div>
                  )}
                  {editor && p.active && p.advance > 0.005 && formData && (
                    <AdvanceForm d={d} paymentId={p.id} open={open} method={p.method} currency={p.currency} advance={p.advance} rates={formData.rates} />
                  )}
                </div>
              ))}
              {payments.length === 0 && <p className="p-4 text-sm text-muted">{t("common.none")}</p>}
            </div>
          </section>
        </div>

        {formData && (
          <aside className="card grid min-w-0 flex-[1_1_340px] gap-3 border-2 border-accent p-5">
            <h2 className="text-lg font-semibold">{t("pay.receive")}</h2>
            <PaymentForm d={d} clientId={c.id} open={open} currencies={formData.currencies} drivers={formData.drivers} rates={formData.rates} today={today} accounts={accounts} />
          </aside>
        )}
      </div>

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
