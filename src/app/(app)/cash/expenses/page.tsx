import Link from "next/link";
import { getDict, getT } from "@/i18n";
import { db } from "@/lib/db";
import { formatNumber } from "@/lib/currency-core";
import { formatDate } from "@/lib/dates";
import { tashkentToday } from "@/lib/docs";
import { loadAccounts, loadCategories } from "@/lib/cash";
import { parsePeriod } from "@/lib/cash-core";
import { cashContext } from "../context";
import { CashHeader, CashUnavailable } from "../CashHeader";
import { PeriodFilter } from "../PeriodFilter";
import { CancelExpenseButton, ExpenseForm } from "../forms";

type SP = { org?: string; month?: string; from?: string; to?: string; account?: string; cat?: string };

/** Xarajatlar: yangi xarajat (turkum › bo'lim, summa, qaysi hisobdan) va davr bo'yicha ro'yxat. */
export default async function ExpensesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ctx = await cashContext(sp.org);
  const [t, d] = [await getT(), await getDict()];
  const header = <CashHeader ctx={ctx} t={t} active="/cash/expenses" />;
  if (!ctx.orgId || !ctx.enabled) return <div className="grid gap-6">{header}<CashUnavailable ctx={ctx} t={t} /></div>;

  const today = tashkentToday().toISOString().slice(0, 10);
  const period = parsePeriod(today, sp);
  const [accounts, categories] = await Promise.all([loadAccounts(ctx.orgId, true), loadCategories(ctx.orgId)]);
  const cat = categories.find((c) => c.id === sp.cat);
  const account = accounts.find((a) => a.id === sp.account);
  const expenses = await db.expense.findMany({
    where: {
      orgId: ctx.orgId, status: "ACTIVE",
      date: { gte: new Date(period.from), lte: new Date(period.to) },
      ...(account ? { accountId: account.id } : {}),
      ...(cat ? { OR: [{ categoryId: cat.id }, { category: { parentId: cat.id } }] } : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: { account: true, category: { include: { parent: true } } },
    take: 500,
  });
  const totals = new Map<string, number>();
  for (const e of expenses) totals.set(e.account.currency, (totals.get(e.account.currency) ?? 0) + Number(e.amount));
  const active = accounts.filter((a) => a.active).map(({ id, kind, currency, label }) => ({ id, kind, currency, label }));

  return (
    <div className="grid gap-6">
      {header}
      <div className="grid gap-6">
        <div className="grid min-w-0 gap-4">
          <PeriodFilter
            t={t} org={ctx.q ? ctx.orgId : null} period={period} account={account?.id}
            accounts={accounts.map((a) => ({ id: a.id, label: a.label }))}
            extra={
              <div className="min-w-0 flex-1 basis-40">
                <label htmlFor="pf-cat" className="label">{t("cash.category")}</label>
                <select id="pf-cat" name="cat" defaultValue={cat?.id ?? ""} className="input">
                  <option value="">{t("cash.allCategories")}</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            }
          />
          {totals.size > 0 && (
            <div className="card flex flex-wrap items-baseline gap-x-6 gap-y-1 p-4">
              <span className="text-sm text-muted">{t("cash.expensesTotal")}</span>
              {[...totals.entries()].map(([cur, v]) => <span key={cur} className="text-xl font-bold tabular-nums text-bad">{`${formatNumber(v)} ${cur}`}</span>)}
            </div>
          )}
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">{t("pay.date")}</th>
                  <th className="px-4 py-2 font-medium">{t("cash.category")}</th>
                  <th className="px-4 py-2 font-medium">{t("cash.account")}</th>
                  <th className="px-4 py-2 text-right font-medium">{t("cash.amount")}</th>
                  {ctx.canEdit && <th className="px-4 py-2" />}
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-t border-line align-top">
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{formatDate(e.date)}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/cash/expenses/${e.id}${ctx.q ? `?${ctx.q}` : ""}`} className="font-medium text-accent hover:underline">
                        {e.category.parent ? `${e.category.parent.name} › ${e.category.name}` : e.category.name}
                      </Link>
                      {e.note && <div className="text-xs text-muted">{e.note}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-muted">{e.account.name}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums">{`${formatNumber(Number(e.amount))} ${e.account.currency}`}</td>
                    {ctx.canEdit && <td className="px-4 py-2.5 text-right"><CancelExpenseButton d={d} id={e.id} /></td>}
                  </tr>
                ))}
                {expenses.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-muted">{t("common.none")}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        {ctx.canEdit && (
          <aside className="card order-first grid min-w-0 gap-3 border-2 border-accent p-5">
            <h2 className="text-lg font-semibold">{t("cash.addExpense")}</h2>
            <ExpenseForm d={d} accounts={active} categories={categories} orgField={ctx.orgField} today={today} />
          </aside>
        )}
      </div>
    </div>
  );
}
