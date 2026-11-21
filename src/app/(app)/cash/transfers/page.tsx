import { getDict, getT } from "@/i18n";
import { ExcelButton } from "@/components/ExcelButton";
import { db } from "@/lib/db";
import { formatNumber, rateDigits } from "@/lib/currency-core";
import { formatDate } from "@/lib/dates";
import { tashkentToday } from "@/lib/docs";
import { ensureRates, rateMap } from "@/lib/rates";
import { loadAccounts } from "@/lib/cash";
import { parsePeriod } from "@/lib/cash-core";
import { cashContext } from "../context";
import { CashHeader, CashUnavailable } from "../CashHeader";
import { PeriodFilter } from "../PeriodFilter";
import { CancelTransferButton, TransferForm } from "../forms";

type SP = { org?: string; month?: string; from?: string; to?: string };

/** Hisoblar orasida o'tkazmalar: kassadan bankka, kartadan naqdga, valyuta ayirboshlash (kurs bilan). */
export default async function TransfersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ctx = await cashContext(sp.org);
  const [t, d] = [await getT(), await getDict()];
  const header = <CashHeader ctx={ctx} t={t} active="/cash/transfers" />;
  if (!ctx.orgId || !ctx.enabled) return <div className="grid gap-6">{header}<CashUnavailable ctx={ctx} t={t} /></div>;

  const today = tashkentToday().toISOString().slice(0, 10);
  const period = parsePeriod(today, sp);
  const [accounts, transfers] = await Promise.all([
    loadAccounts(ctx.orgId),
    db.cashTransfer.findMany({
      where: { orgId: ctx.orgId, status: "ACTIVE", date: { gte: new Date(period.from), lte: new Date(period.to) } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: { fromAccount: true, toAccount: true },
      take: 500,
    }),
  ]);
  let rates = {};
  if (ctx.canEdit) {
    await ensureRates([today], today);
    rates = await rateMap(today);
  }

  return (
    <div className="grid gap-6">
      {header}
      <div className="grid gap-6">
        <div className="grid min-w-0 gap-4">
          <PeriodFilter t={t} org={ctx.q ? ctx.orgId : null} period={period} />
          <div className="card overflow-x-auto">
            <div className="flex justify-end border-b border-line px-3 py-1 print:hidden"><ExcelButton label={t("common.excel")} target="xl-cash-transfers-page" file={t("nav.cash")} /></div>
            <table id="xl-cash-transfers-page" className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">{t("pay.date")}</th>
                  <th className="px-4 py-2 font-medium">{t("cash.transferFrom")} → {t("cash.transferTo")}</th>
                  <th className="px-4 py-2 text-right font-medium">{t("cash.transferAmount")}</th>
                  <th className="px-4 py-2 text-right font-medium">{t("cash.received")}</th>
                  {ctx.canEdit && <th className="px-4 py-2" />}
                </tr>
              </thead>
              <tbody>
                {transfers.map((x) => (
                  <tr key={x.id} className="border-t border-line align-top">
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{formatDate(x.date)}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-medium">{x.fromAccount.name}</span> → <span className="font-medium">{x.toAccount.name}</span>
                      {x.rate && <div className="text-xs text-muted">{t("calc.rate")} 1 {x.rateBase} = {formatNumber(Number(x.rate), rateDigits(Number(x.rate)))} {x.rateBase === x.fromAccount.currency ? x.toAccount.currency : x.fromAccount.currency}{x.rateManual ? `, ${t("pay.manualRate")}` : `, ${t("pay.cbuRate")}`}</div>}
                      {x.note && <div className="text-xs text-muted">{x.note}</div>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-bad">{`−${formatNumber(Number(x.amount))} ${x.fromAccount.currency}`}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-accent">{`+${formatNumber(Number(x.toAmount))} ${x.toAccount.currency}`}</td>
                    {ctx.canEdit && <td className="px-4 py-2.5 text-right"><CancelTransferButton d={d} id={x.id} /></td>}
                  </tr>
                ))}
                {transfers.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-muted">{t("common.none")}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        {ctx.canEdit && (
          <aside className="card order-first grid min-w-0 gap-3 border-2 border-accent p-5">
            <h2 className="text-lg font-semibold">{t("cash.addTransfer")}</h2>
            {accounts.length < 2 ? (
              <p className="text-sm text-muted">{t("cash.needTwo")}</p>
            ) : (
              <TransferForm d={d} accounts={accounts.map(({ id, kind, currency, label }) => ({ id, kind, currency, label }))} rates={rates} today={today} orgField={ctx.orgField} />
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
