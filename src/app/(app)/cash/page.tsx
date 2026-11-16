import Link from "next/link";
import { getT } from "@/i18n";
import { formatNumber } from "@/lib/currency-core";
import { formatDate } from "@/lib/dates";
import { tashkentToday } from "@/lib/docs";
import { balances, loadAccounts, loadMovements, trackedOnly } from "@/lib/cash";
import { parsePeriod, turnover } from "@/lib/cash-core";
import { cashContext } from "./context";
import { CashHeader, CashUnavailable } from "./CashHeader";
import { PeriodFilter } from "./PeriodFilter";

type SP = { org?: string; month?: string; from?: string; to?: string; account?: string };

const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "");

/** Kassa: hisoblar qoldig'i, tanlangan davr aylanmasi (kirim, chiqim, qoldiq), xarajatlar turkum bo'yicha, harakatlar. */
export default async function CashPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ctx = await cashContext(sp.org);
  const t = await getT();
  const header = <CashHeader ctx={ctx} t={t} active="/cash" />;
  if (!ctx.orgId || !ctx.enabled) return <div className="grid gap-6">{header}<CashUnavailable ctx={ctx} t={t} /></div>;

  const today = tashkentToday().toISOString().slice(0, 10);
  const period = parsePeriod(today, sp);
  const allAccounts = await loadAccounts(ctx.orgId, true);
  // Aylanmasi yuritilmaydigan hisoblar (masalan rahbar kartasi) kassa qoldig'i va aylanmasida ko'rinmaydi.
  const { accounts, movements } = trackedOnly(allAccounts, await loadMovements(ctx.orgId));
  const untracked = allAccounts.filter((a) => a.untracked && a.active);
  const current = balances(accounts, movements);
  const rows = accounts
    .map((a) => ({ a, tv: turnover(a.openingBalance, movements.filter((m) => m.accountId === a.id), period.from, period.to) }))
    .filter((r) => r.a.active || r.tv.opening || r.tv.income || r.tv.expense);

  // Jami — har valyuta alohida.
  const totals = new Map<string, { opening: number; income: number; expense: number; closing: number }>();
  for (const { a, tv } of rows) {
    const s = totals.get(a.currency) ?? { opening: 0, income: 0, expense: 0, closing: 0 };
    totals.set(a.currency, { opening: s.opening + tv.opening, income: s.income + tv.income, expense: s.expense + tv.expense, closing: s.closing + tv.closing });
  }

  const accountFilter = accounts.find((a) => a.id === sp.account);
  const inPeriod = movements.filter((m) => m.day >= period.from && m.day <= period.to && (!accountFilter || m.accountId === accountFilter.id));
  const accName = new Map(accounts.map((a) => [a.id, a.label]));

  // Xarajatlar turkum bo'yicha (davr ichida).
  const byCat = new Map<string, Map<string, number>>();
  for (const m of inPeriod.filter((x) => x.kind === "expense")) {
    const top = m.title.split(" › ")[0];
    const inner = byCat.get(top) ?? new Map<string, number>();
    inner.set(m.currency, (inner.get(m.currency) ?? 0) - m.amount);
    byCat.set(top, inner);
  }
  const qs = (extra: Record<string, string>) => new URLSearchParams({ ...(ctx.q ? { org: ctx.orgId! } : {}), ...extra }).toString();

  return (
    <div className="grid gap-6">
      {header}

      {accounts.length === 0 ? (
        <div className="card grid gap-3 p-5 text-sm">
          <p>{t("cash.noAccounts")}</p>
          <Link href={`/cash/accounts${ctx.q ? `?${ctx.q}` : ""}`} className="btn w-fit">{t("cash.addAccount")}</Link>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3" aria-label={t("cash.balances")}>
            {accounts.filter((a) => a.active).map((a) => {
              const b = current.get(a.id) ?? 0;
              return (
                <Link key={a.id} href={`/cash?${qs({ account: a.id, ...(period.month ? { month: period.month } : { from: period.from, to: period.to }) })}`} className="card grid gap-1 p-4 hover:border-accent">
                  <span className="text-xs text-muted">{t(`cash.k.${a.kind}`)}</span>
                  <span className="truncate font-semibold">{a.name}</span>
                  {a.kind === "CARD" && a.cardHolder && <span className="truncate text-xs text-muted">{a.cardHolder}</span>}
                  <span className={`text-2xl font-bold tabular-nums ${b < 0 ? "text-bad" : ""}`}>{formatNumber(b)} <span className="text-base font-semibold">{a.currency}</span></span>
                </Link>
              );
            })}
          </section>

          {untracked.length > 0 && (
            <p className="text-xs text-muted">
              {t("cash.untrackedList")}:{" "}
              {untracked.map((a, i) => (
                <span key={a.id}>{i > 0 && ", "}<Link href={`/cash/accounts/${a.id}${ctx.q ? `?${ctx.q}` : ""}`} className="text-accent hover:underline">{a.name}</Link></span>
              ))}
            </p>
          )}

          <PeriodFilter t={t} org={ctx.q ? ctx.orgId : null} period={period} account={accountFilter?.id} accounts={accounts.map((a) => ({ id: a.id, label: a.label }))} />
          {accountFilter && (
            <Link href={`/cash/accounts/${accountFilter.id}?${qs(period.month ? { month: period.month } : { from: period.from, to: period.to })}#statement`} className="text-sm font-semibold text-accent hover:underline">
              {t("cash.statementOpen")} →
            </Link>
          )}

          <section className="grid gap-2">
            <h2 className="text-lg font-semibold">{t("cash.turnover")}: {formatDate(new Date(period.from))} — {formatDate(new Date(period.to))}</h2>
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr>
                    <th className="px-4 py-2 font-medium">{t("cash.account")}</th>
                    <th className="px-4 py-2 text-right font-medium">{t("cash.opening")}</th>
                    <th className="px-4 py-2 text-right font-medium">{t("cash.income")}</th>
                    <th className="px-4 py-2 text-right font-medium">{t("cash.expense")}</th>
                    <th className="px-4 py-2 text-right font-medium">{t("cash.closing")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ a, tv }) => (
                    <tr key={a.id} className={`border-t border-line ${a.active ? "" : "text-muted"}`}>
                      <td className="px-4 py-2.5">
                        <span className="font-medium">{a.name}</span> <span className="text-xs text-muted">· {t(`cash.k.${a.kind}`)} · {a.currency}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{formatNumber(tv.opening)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-accent">{tv.income ? `+${formatNumber(tv.income)}` : "0"}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-bad">{tv.expense ? `−${formatNumber(tv.expense)}` : "0"}</td>
                      <td className={`whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums ${tv.closing < 0 ? "text-bad" : ""}`}>{formatNumber(tv.closing)}</td>
                    </tr>
                  ))}
                  {[...totals.entries()].map(([cur, s]) => (
                    <tr key={cur} className="border-t-2 border-line bg-ground font-semibold">
                      <td className="px-4 py-2.5">{`${t("cash.total")}, ${cur}`}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{formatNumber(s.opening)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{s.income ? `+${formatNumber(s.income)}` : "0"}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{s.expense ? `−${formatNumber(s.expense)}` : "0"}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{formatNumber(s.closing)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-line px-4 py-3 text-xs text-muted">{t("cash.formula")}</p>
            </div>
          </section>

          {byCat.size > 0 && (
            <section className="grid gap-2">
              <h2 className="text-lg font-semibold">{t("cash.byCategory")}</h2>
              <div className="card divide-y divide-line">
                {[...byCat.entries()].map(([cat, sums]) => (
                  <div key={cat} className="flex flex-wrap items-baseline gap-x-4 px-4 py-2.5 text-sm">
                    <span className="font-medium">{cat}</span>
                    <span className="flex-1" />
                    {[...sums.entries()].map(([cur, v]) => <span key={cur} className="font-semibold tabular-nums">{formatNumber(v)} {cur}</span>)}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="grid gap-2">
            <h2 className="text-lg font-semibold">{t("cash.movements")}{accountFilter ? ` — ${accountFilter.name}` : ""}</h2>
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr>
                    <th className="px-4 py-2 font-medium">{t("pay.date")}</th>
                    <th className="px-4 py-2 font-medium">{t("cash.operation")}</th>
                    <th className="px-4 py-2 font-medium">{t("cash.account")}</th>
                    <th className="px-4 py-2 text-right font-medium">{t("cash.amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {inPeriod.map((m) => (
                    <tr key={`${m.kind}-${m.id}`} className="border-t border-line align-top">
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{formatDate(new Date(m.day))}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs text-muted">{t(`cash.mv.${m.kind}`)}</span>{" "}
                        {m.href ? <Link href={m.href} className="font-medium text-accent hover:underline">{m.title}</Link> : <span className="font-medium">{m.title}</span>}
                        {m.sub && <div className="text-xs text-muted">{m.sub}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-muted">{accName.get(m.accountId)}</td>
                      <td className={`whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums ${m.amount < 0 ? "text-bad" : "text-accent"}`}>
                        {`${sign(m.amount)}${formatNumber(Math.abs(m.amount))} ${m.currency}`}
                      </td>
                    </tr>
                  ))}
                  {inPeriod.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-muted">{t("common.none")}</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
