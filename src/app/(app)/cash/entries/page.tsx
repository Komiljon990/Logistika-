import { getDict, getT } from "@/i18n";
import { db } from "@/lib/db";
import { formatNumber } from "@/lib/currency-core";
import { formatDate } from "@/lib/dates";
import { tashkentToday } from "@/lib/docs";
import { loadAccounts } from "@/lib/cash";
import { parsePeriod } from "@/lib/cash-core";
import { cashContext } from "../context";
import { CashHeader, CashUnavailable } from "../CashHeader";
import { PeriodFilter } from "../PeriodFilter";
import { CancelEntryButton, EntryForm } from "../forms";

type SP = { org?: string; month?: string; from?: string; to?: string };

/** Tashishlardan tashqari kirim va chiqim: ta'sischi/rahbar qo'ygan pul, boshqa tashkilotdan yordam, qaytarilgan pul. */
export default async function EntriesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ctx = await cashContext(sp.org);
  const [t, d] = [await getT(), await getDict()];
  const header = <CashHeader ctx={ctx} t={t} active="/cash/entries" />;
  if (!ctx.orgId || !ctx.enabled) return <div className="grid gap-6">{header}<CashUnavailable ctx={ctx} t={t} /></div>;

  const today = tashkentToday().toISOString().slice(0, 10);
  const period = parsePeriod(today, sp);
  const [accounts, entries] = await Promise.all([
    loadAccounts(ctx.orgId),
    db.cashEntry.findMany({
      where: { orgId: ctx.orgId, status: "ACTIVE", date: { gte: new Date(period.from), lte: new Date(period.to) } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: { account: { select: { name: true, currency: true } } },
      take: 500,
    }),
  ]);
  const totals = new Map<string, { inc: number; out: number }>();
  for (const e of entries) {
    const s = totals.get(e.account.currency) ?? { inc: 0, out: 0 };
    if (e.direction === "IN") s.inc += Number(e.amount); else s.out += Number(e.amount);
    totals.set(e.account.currency, s);
  }

  return (
    <div className="grid gap-6">
      {header}
      {ctx.canEdit && (
        <section className="card grid gap-3 border-2 border-accent p-5">
          <div className="grid gap-1">
            <h2 className="text-lg font-semibold">{t("cash.addEntry")}</h2>
            <p className="text-sm text-muted">{t("cash.entryHint")}</p>
          </div>
          <EntryForm d={d} accounts={accounts.map(({ id, kind, currency, label }) => ({ id, kind, currency, label }))} today={today} orgField={ctx.orgField} />
        </section>
      )}
      <PeriodFilter t={t} org={ctx.q ? ctx.orgId : null} period={period} />
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">{t("pay.date")}</th>
              <th className="px-4 py-2 font-medium">{t("cash.party")}</th>
              <th className="px-4 py-2 font-medium">{t("cash.account")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("cash.amount")}</th>
              {ctx.canEdit && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-line align-top">
                <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{formatDate(e.date)}</td>
                <td className="px-4 py-2.5">
                  <span className="text-xs text-muted">{t(`cash.entry.${e.direction}`)}</span> <span className="font-medium">{e.party}</span>
                  {e.note && <div className="text-xs text-muted">{e.note}</div>}
                </td>
                <td className="px-4 py-2.5 text-muted">{e.account.name}</td>
                <td className={`whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums ${e.direction === "IN" ? "text-accent" : "text-bad"}`}>
                  {`${e.direction === "IN" ? "+" : "−"}${formatNumber(Number(e.amount))} ${e.account.currency}`}
                </td>
                {ctx.canEdit && <td className="px-4 py-2.5 text-right"><CancelEntryButton d={d} id={e.id} /></td>}
              </tr>
            ))}
            {[...totals.entries()].map(([cur, s]) => (
              <tr key={cur} className="border-t-2 border-line bg-ground font-semibold">
                <td className="px-4 py-2.5" colSpan={3}>{t("cash.total")}, {cur}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                  <span className="text-accent">+{formatNumber(s.inc)}</span> / <span className="text-bad">−{formatNumber(s.out)}</span>
                </td>
                {ctx.canEdit && <td />}
              </tr>
            ))}
            {entries.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-muted">{t("common.none")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
