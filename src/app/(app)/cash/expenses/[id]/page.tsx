import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict, getT } from "@/i18n";
import { db } from "@/lib/db";
import { formatNumber } from "@/lib/currency-core";
import { formatDate } from "@/lib/dates";
import { tashkentToday } from "@/lib/docs";
import { loadAccounts, loadCategories } from "@/lib/cash";
import { cashContext } from "../../context";
import { CashUnavailable } from "../../CashHeader";
import { CancelExpenseButton, ExpenseForm } from "../../forms";

/** Bitta xarajat: tahrirlash va o'chirish (hisobchi, menejer); boshqalar ko'radi. */
export default async function ExpensePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ org?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const e = await db.expense.findUnique({ where: { id }, include: { account: true, category: { include: { parent: true } } } });
  // Tashkilot yozuvning o'zidan olinadi: tashkilot foydalanuvchisi boshqa tashkilot yozuvini ko'ra olmaydi.
  const ctx = await cashContext(e?.orgId ?? sp.org);
  if (!e || ctx.orgId !== e.orgId) notFound();
  const [t, d] = [await getT(), await getDict()];
  const back = `/cash/expenses${ctx.q ? `?${ctx.q}` : ""}`;
  if (!ctx.enabled) return <div className="grid gap-6"><Link href={back} className="text-sm text-accent hover:underline">← {t("cash.tab.expenses")}</Link><CashUnavailable ctx={ctx} t={t} /></div>;
  const today = tashkentToday().toISOString().slice(0, 10);
  const editable = ctx.canEdit && e.status === "ACTIVE";
  const [accounts, categories] = editable ? await Promise.all([loadAccounts(e.orgId), loadCategories(e.orgId)]) : [[], []];
  const title = e.category.parent ? `${e.category.parent.name} › ${e.category.name}` : e.category.name;

  return (
    <div className="grid max-w-2xl gap-6">
      <Link href={back} className="text-sm text-accent hover:underline">← {t("cash.tab.expenses")}</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{title}</h1>
        {e.status !== "ACTIVE" && <span className="rounded-full bg-bad-soft px-2 py-0.5 text-xs font-semibold text-bad">{t("cash.deleted")}</span>}
        <span className="flex-1" />
        {editable && <CancelExpenseButton d={d} id={e.id} back />}
      </div>
      {editable ? (
        <section className="card p-5">
          <ExpenseForm
            d={d} orgField={ctx.orgField} today={today} categories={categories}
            accounts={accounts.map(({ id, kind, currency, label }) => ({ id, kind, currency, label }))}
            expense={{
              id: e.id, date: e.date.toISOString().slice(0, 10), accountId: e.accountId, amount: String(Number(e.amount)),
              parentId: e.category.parentId ?? e.categoryId, categoryId: e.categoryId, note: e.note ?? "",
            }}
          />
        </section>
      ) : (
        <dl className="card grid gap-2 p-5 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted">{t("pay.date")}</dt><dd>{formatDate(e.date)}</dd>
          <dt className="text-muted">{t("cash.amount")}</dt><dd className="font-semibold tabular-nums">{formatNumber(Number(e.amount))} {e.account.currency}</dd>
          <dt className="text-muted">{t("cash.fromAccount")}</dt><dd>{e.account.name}</dd>
          {e.note && <><dt className="text-muted">{t("common.note")}</dt><dd>{e.note}</dd></>}
        </dl>
      )}
    </div>
  );
}
