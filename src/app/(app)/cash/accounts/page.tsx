import Link from "next/link";
import { getDict, getT } from "@/i18n";
import { formatNumber } from "@/lib/currency-core";
import { activeCurrencies } from "@/lib/org-currency";
import { balances, loadAccounts, loadMovements } from "@/lib/cash";
import { formatCard } from "@/lib/cash-core";
import { cashContext } from "../context";
import { CashHeader, CashUnavailable } from "../CashHeader";
import { AccountForm } from "../forms";

/** Hisoblar: bank hisob raqamlari (bank, MFO, raqam, valyuta), naqd kassalar, plastik kartalar (kimniki). */
export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const sp = await searchParams;
  const ctx = await cashContext(sp.org);
  const [t, d] = [await getT(), await getDict()];
  const header = <CashHeader ctx={ctx} t={t} active="/cash/accounts" />;
  if (!ctx.orgId || !ctx.enabled) return <div className="grid gap-6">{header}<CashUnavailable ctx={ctx} t={t} /></div>;

  const [accounts, movements, currencies] = await Promise.all([loadAccounts(ctx.orgId, true), loadMovements(ctx.orgId), activeCurrencies(ctx.orgId)]);
  const current = balances(accounts, movements);
  const q = ctx.q ? `?${ctx.q}` : "";

  return (
    <div className="grid gap-6">
      {header}
      <div className="flex flex-wrap items-start gap-6">
        <div className="grid min-w-0 flex-[999_1_520px] gap-4">
          {(["BANK", "CASH", "CARD"] as const).map((kind) => {
            const list = accounts.filter((a) => a.kind === kind);
            return (
              <section key={kind} className="grid gap-2">
                <h2 className="text-lg font-semibold">{t(`cash.kinds.${kind}`)}</h2>
                <div className="card divide-y divide-line">
                  {list.map((a) => (
                    <Link key={a.id} href={`/cash/accounts/${a.id}${q}`} className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3 text-sm hover:bg-ground ${a.active ? "" : "text-muted"}`}>
                      <span className="min-w-0">
                        <span className="font-semibold text-accent">{a.name}</span>
                        {!a.active && <span className="ml-2 text-xs">({t("status.ARCHIVED")})</span>}
                        <span className="block text-xs text-muted tabular-nums">
                          {kind === "BANK" && `${t("cash.mfo")} ${a.mfo} · ${a.accountNumber}`}
                          {kind === "CARD" && `${formatCard(a.cardNumber ?? "")} · ${a.cardHolder}`}
                          {kind === "CASH" && (a.note ?? "")}
                        </span>
                      </span>
                      <span className="flex-1" />
                      {a.untracked ? (
                        <span className="text-xs text-muted">{t("cash.untrackedShort")}</span>
                      ) : (
                        <span className={`font-bold tabular-nums ${(current.get(a.id) ?? 0) < 0 ? "text-bad" : ""}`}>{`${formatNumber(current.get(a.id) ?? 0)} ${a.currency}`}</span>
                      )}
                    </Link>
                  ))}
                  {list.length === 0 && <p className="px-4 py-3 text-sm text-muted">{t("common.none")}</p>}
                </div>
              </section>
            );
          })}
        </div>
        {ctx.canEdit && (
          <aside className="card grid min-w-0 flex-[1_1_340px] gap-3 border-2 border-accent p-5">
            <h2 className="text-lg font-semibold">{t("cash.addAccount")}</h2>
            <AccountForm d={d} currencies={currencies} orgField={ctx.orgField} />
          </aside>
        )}
      </div>
    </div>
  );
}
