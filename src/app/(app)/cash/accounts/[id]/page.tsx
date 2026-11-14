import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict, getT } from "@/i18n";
import { db } from "@/lib/db";
import { formatNumber } from "@/lib/currency-core";
import { activeCurrencies } from "@/lib/org-currency";
import { loadMovements } from "@/lib/cash";
import { balance, formatCard } from "@/lib/cash-core";
import { cashContext } from "../../context";
import { CashUnavailable } from "../../CashHeader";
import { AccountForm, AccountStatusButton } from "../../forms";

/** Bitta hisob: rekvizitlar, joriy qoldiq, tahrirlash va nofaol qilish. */
export default async function AccountPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ org?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const a = await db.cashAccount.findUnique({ where: { id } });
  const ctx = await cashContext(a?.orgId ?? sp.org);
  if (!a || ctx.orgId !== a.orgId) notFound();
  const [t, d] = [await getT(), await getDict()];
  const q = ctx.q ? `?${ctx.q}` : "";
  const back = <Link href={`/cash/accounts${q}`} className="text-sm text-accent hover:underline">← {t("cash.tab.accounts")}</Link>;
  if (!ctx.enabled) return <div className="grid gap-6">{back}<CashUnavailable ctx={ctx} t={t} /></div>;
  const movements = await loadMovements(a.orgId, { accountId: a.id });
  const bal = balance(Number(a.openingBalance), movements);
  const currencies = ctx.canEdit ? await activeCurrencies(a.orgId) : [];

  return (
    <div className="grid max-w-3xl gap-6">
      {back}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{a.name}</h1>
        <span className="text-muted">{t(`cash.k.${a.kind}`)} · {a.currency}</span>
        {a.status !== "ACTIVE" && <span className="rounded-full bg-ground px-2 py-0.5 text-xs font-semibold text-muted">{t("status.ARCHIVED")}</span>}
        <span className="flex-1" />
        {ctx.canEdit && <AccountStatusButton d={d} id={a.id} active={a.status === "ACTIVE"} />}
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <div className="card p-4">
          <div className="text-xs text-muted">{t("cash.balanceNow")}</div>
          <div className={`mt-1 text-2xl font-bold tabular-nums ${bal < 0 ? "text-bad" : ""}`}>{`${formatNumber(bal)} ${a.currency}`}</div>
        </div>
        <div className="card p-4 text-sm">
          {a.kind === "BANK" && <><div className="text-xs text-muted">{t("cash.mfo")} · {t("cash.accountNumber")}</div><div className="mt-1 font-semibold tabular-nums">{a.mfo} · {a.accountNumber}</div></>}
          {a.kind === "CARD" && <><div className="text-xs text-muted">{t("cash.cardNumber")} · {t("cash.cardHolder")}</div><div className="mt-1 font-semibold tabular-nums">{formatCard(a.cardNumber ?? "")}</div><div>{a.cardHolder}</div></>}
          {a.kind === "CASH" && <><div className="text-xs text-muted">{t("cash.openingBalance")}</div><div className="mt-1 font-semibold tabular-nums">{formatNumber(Number(a.openingBalance))} {a.currency}</div></>}
        </div>
      </div>
      <Link href={`/cash?${new URLSearchParams({ ...(ctx.q ? { org: a.orgId } : {}), account: a.id }).toString()}`} className="text-sm text-accent hover:underline">{t("cash.seeMovements")} →</Link>
      {ctx.canEdit && a.status === "ACTIVE" && (
        <section className="card grid gap-3 p-5">
          <h2 className="text-lg font-semibold">{t("common.edit")}</h2>
          <AccountForm
            d={d} currencies={currencies} orgField={ctx.orgField}
            account={{
              id: a.id, kind: a.kind, name: a.name, mfo: a.mfo ?? "", accountNumber: a.accountNumber ?? "", cardNumber: a.cardNumber ?? "",
              cardHolder: a.cardHolder ?? "", currency: a.currency, openingBalance: String(Number(a.openingBalance)), note: a.note ?? "",
            }}
          />
        </section>
      )}
    </div>
  );
}
