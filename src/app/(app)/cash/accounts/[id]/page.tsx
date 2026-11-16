import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict, getT } from "@/i18n";
import { db } from "@/lib/db";
import { formatNumber } from "@/lib/currency-core";
import { formatDate } from "@/lib/dates";
import { tashkentToday } from "@/lib/docs";
import { activeCurrencies } from "@/lib/org-currency";
import { loadMovements } from "@/lib/cash";
import { accountLabel, balance, formatCard, parsePeriod, statement } from "@/lib/cash-core";
import { PrintButton } from "@/components/PrintButton";
import { cashContext } from "../../context";
import { CashUnavailable } from "../../CashHeader";
import { PeriodFilter } from "../../PeriodFilter";
import { AccountForm, AccountStatusButton } from "../../forms";

type SP = { org?: string; month?: string; from?: string; to?: string };

/**
 * Bitta hisob: rekvizitlar, joriy qoldiq va tanlangan davr uchun ko'chirma (bank ko'chirmasi kabi: har bir kirim va
 * chiqim, undan keyingi qoldiq). Aylanmasi yuritilmaydigan hisobda qoldiq ko'rsatilmaydi — faqat harakatlar tarixi.
 */
export default async function AccountPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const { id } = await params;
  const sp = await searchParams;
  const a = await db.cashAccount.findUnique({ where: { id } });
  const ctx = await cashContext(a?.orgId ?? sp.org);
  if (!a || ctx.orgId !== a.orgId) notFound();
  const [t, d] = [await getT(), await getDict()];
  const q = ctx.q ? `?${ctx.q}` : "";
  const back = <Link href={`/cash/accounts${q}`} className="text-sm text-accent hover:underline print:hidden">← {t("cash.tab.accounts")}</Link>;
  if (!ctx.enabled) return <div className="grid gap-6">{back}<CashUnavailable ctx={ctx} t={t} /></div>;
  const movements = await loadMovements(a.orgId, { accountId: a.id });
  const bal = balance(Number(a.openingBalance), movements);
  const currencies = ctx.canEdit ? await activeCurrencies(a.orgId) : [];
  const today = tashkentToday().toISOString().slice(0, 10);
  const period = parsePeriod(today, sp);
  const st = statement(Number(a.openingBalance), movements, period.from, period.to);
  const tracked = !a.untracked;
  const sign = (n: number) => (n > 0 ? "+" : "−");

  return (
    <div className="grid max-w-4xl gap-6">
      {back}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{a.name}</h1>
        <span className="text-muted">{t(`cash.k.${a.kind}`)} · {a.currency}</span>
        {a.untracked && <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">{t("cash.untrackedShort")}</span>}
        {a.status !== "ACTIVE" && <span className="rounded-full bg-ground px-2 py-0.5 text-xs font-semibold text-muted">{t("status.ARCHIVED")}</span>}
        <span className="flex-1" />
        {ctx.canEdit && <span className="print:hidden"><AccountStatusButton d={d} id={a.id} active={a.status === "ACTIVE"} /></span>}
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        {tracked ? (
          <div className="card p-4">
            <div className="text-xs text-muted">{t("cash.balanceNow")}</div>
            <div className={`mt-1 text-2xl font-bold tabular-nums ${bal < 0 ? "text-bad" : ""}`}>{`${formatNumber(bal)} ${a.currency}`}</div>
          </div>
        ) : (
          <div className="card p-4 text-sm text-muted">{t("cash.untrackedHint")}</div>
        )}
        <div className="card p-4 text-sm">
          {a.kind === "BANK" && <><div className="text-xs text-muted">{t("cash.mfo")} · {t("cash.accountNumber")}</div><div className="mt-1 font-semibold tabular-nums">{a.mfo} · {a.accountNumber}</div></>}
          {a.kind === "CARD" && <><div className="text-xs text-muted">{t("cash.cardNumber")} · {t("cash.cardHolder")}</div><div className="mt-1 font-semibold tabular-nums">{formatCard(a.cardNumber ?? "")}</div><div>{a.cardHolder}</div></>}
          {a.kind === "CASH" && <><div className="text-xs text-muted">{t("cash.openingBalance")}</div><div className="mt-1 font-semibold tabular-nums">{formatNumber(Number(a.openingBalance))} {a.currency}</div></>}
        </div>
      </div>

      <section id="statement" className="grid scroll-mt-20 gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">{tracked ? t("cash.statement") : t("cash.history")}: {formatDate(new Date(period.from))} — {formatDate(new Date(period.to))}</h2>
          <span className="flex-1" />
          <PrintButton label={t("common.print")} />
        </div>
        <div className="print:hidden"><PeriodFilter t={t} org={ctx.q ? ctx.orgId : null} period={period} /></div>
        <p className="hidden text-sm print:block">{accountLabel(a)}</p>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">{t("pay.date")}</th>
                <th className="px-3 py-2 font-medium">{t("cash.operation")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("cash.income")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("cash.expense")}</th>
                {tracked && <th className="px-3 py-2 text-right font-medium">{t("cash.balanceAfter")}</th>}
              </tr>
            </thead>
            <tbody>
              {tracked && (
                <tr className="border-t border-line bg-ground font-semibold">
                  <td className="px-3 py-2" colSpan={4}>{t("cash.opening")}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatNumber(st.opening)}</td>
                </tr>
              )}
              {st.rows.map((m) => (
                <tr key={`${m.kind}-${m.id}`} className="border-t border-line align-top">
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatDate(new Date(m.day))}</td>
                  <td className="px-3 py-2">
                    <span className="text-xs text-muted">{t(`cash.mv.${m.kind}`)}</span>{" "}
                    {m.href ? <Link href={m.href} className="font-medium text-accent hover:underline">{m.title}</Link> : <span className="font-medium">{m.title}</span>}
                    {m.sub && <div className="text-xs text-muted">{m.sub}</div>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-accent">{m.amount > 0 ? formatNumber(m.amount) : ""}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-bad">{m.amount < 0 ? formatNumber(-m.amount) : ""}</td>
                  {tracked && <td className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${m.balance < 0 ? "text-bad" : ""}`}>{formatNumber(m.balance)}</td>}
                </tr>
              ))}
              {st.rows.length === 0 && <tr><td colSpan={5} className="px-3 py-5 text-muted">{t("common.none")}</td></tr>}
              <tr className="border-t-2 border-line bg-ground font-semibold">
                <td className="px-3 py-2" colSpan={2}>{t("cash.total")}, {a.currency}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{st.income ? `${sign(1)}${formatNumber(st.income)}` : "0"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{st.expense ? `${sign(-1)}${formatNumber(st.expense)}` : "0"}</td>
                {tracked && <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatNumber(st.closing)}</td>}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {ctx.canEdit && a.status === "ACTIVE" && (
        <section className="card grid gap-3 p-5 print:hidden">
          <h2 className="text-lg font-semibold">{t("common.edit")}</h2>
          <AccountForm
            d={d} currencies={currencies} orgField={ctx.orgField}
            account={{
              id: a.id, kind: a.kind, name: a.name, mfo: a.mfo ?? "", accountNumber: a.accountNumber ?? "", cardNumber: a.cardNumber ?? "",
              cardHolder: a.cardHolder ?? "", currency: a.currency, openingBalance: String(Number(a.openingBalance)), note: a.note ?? "",
              untracked: a.untracked,
            }}
          />
        </section>
      )}
    </div>
  );
}
