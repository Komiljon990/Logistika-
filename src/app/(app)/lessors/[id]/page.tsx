import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict, getT } from "@/i18n";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/session";
import { canEdit as canEditSection } from "@/lib/access";
import { orgScope } from "@/lib/scope";
import { formatNumber } from "@/lib/currency-core";
import { formatDate } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";
import { tashkentToday } from "@/lib/docs";
import { activeCurrencies } from "@/lib/org-currency";
import { cashEnabled, loadAccounts } from "@/lib/cash";
import { lessorBalances, lessorStatement } from "@/lib/lessors-core";
import { PrintButton } from "@/components/PrintButton";
import { CancelLessorEntryButton, LessorEntryButtons, LessorForm, LessorStatusButton } from "../forms";

/** Ijarachi: qarz (valyuta bo'yicha), "+ Hisob qo'shish" va "+ To'lov", barcha yozuvlar ko'chirmasi. */
export default async function LessorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSection("lessors");
  const { id } = await params;
  const [t, d] = [await getT(), await getDict()];
  const l = await db.lessor.findFirst({
    where: { id, ...orgScope(user) },
    include: { entries: { where: { status: "ACTIVE" }, include: { account: { select: { name: true } } } } },
  });
  if (!l) notFound();
  const canEdit = canEditSection(user, "lessors") && l.status === "ACTIVE";
  const entries = l.entries.map((e) => ({ ...e, amount: Number(e.amount) }));
  const bal = lessorBalances(entries);
  const rows = lessorStatement(entries);
  const today = tashkentToday().toISOString().slice(0, 10);
  const [currencies, accounts, vehicles] = canEdit
    ? await Promise.all([
        activeCurrencies(l.orgId),
        (await cashEnabled(l.orgId)) ? loadAccounts(l.orgId) : Promise.resolve([]),
        db.vehicle.findMany({ where: { orgId: l.orgId, status: "ACTIVE" }, orderBy: [{ ownership: "desc" }, { plate: "asc" }], select: { id: true, plate: true, ownership: true, leaseOwner: true } }),
      ])
    : [[], [], []];

  return (
    <div className="grid max-w-4xl gap-6">
      <Link href="/lessors" className="text-sm text-accent hover:underline print:hidden">← {t("lessor.title")}</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{l.name}</h1>
        {l.phone && <span className="tabular-nums text-muted">{formatPhone(l.phone)}</span>}
        {l.status !== "ACTIVE" && <span className="rounded-full bg-ground px-2 py-0.5 text-xs font-semibold text-muted">{t("status.ARCHIVED")}</span>}
        <span className="flex-1" />
        <PrintButton label={t("common.print")} />
        {canEditSection(user, "lessors") && <span className="print:hidden"><LessorStatusButton d={d} id={l.id} active={l.status === "ACTIVE"} /></span>}
      </div>

      <section className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        {Object.keys(bal).length === 0 && <p className="card p-4 text-sm text-muted">{t("lessor.noEntries")}</p>}
        {Object.entries(bal).map(([cur, b]) => (
          <div key={cur} className="card grid gap-1 p-4 text-sm">
            <div className="text-xs text-muted">{t("lessor.debt")}, {cur}</div>
            <div className={`text-2xl font-bold tabular-nums ${b.debt > 0 ? "text-bad" : b.debt < 0 ? "text-accent" : ""}`}>{formatNumber(b.debt)}</div>
            <div className="text-xs text-muted tabular-nums">{t("lessor.charged")}: {formatNumber(b.charged)} · {t("settle.paid")}: {formatNumber(b.paid)}</div>
          </div>
        ))}
      </section>

      {canEdit && (
        <div className="print:hidden">
          <LessorEntryButtons
            d={d} lessorId={l.id} currencies={currencies} today={today}
            accounts={accounts.map((a) => ({ id: a.id, label: a.label, currency: a.currency }))}
            vehicles={vehicles.map((v) => ({ id: v.id, label: `${v.plate}${v.ownership === "LEASED" ? ` · ${t("veh.own.LEASED")}${v.leaseOwner ? ` (${v.leaseOwner})` : ""}` : ""}` }))}
          />
        </div>
      )}

      <section className="grid gap-2">
        <h2 className="text-lg font-semibold">{t("lessor.statement")}</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">{t("pay.date")}</th>
                <th className="px-3 py-2 font-medium">{t("cash.operation")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("lessor.charged")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("settle.paid")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("lessor.debt")}</th>
                {canEdit && <th className="px-3 py-2 print:hidden" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-t border-line align-top">
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatDate(e.date)}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{t(e.kind === "CHARGE" ? "lessor.kind.CHARGE" : "lessor.kind.PAYMENT")}</span>
                    {(e.plate || e.account || e.note) && <div className="text-xs text-muted">{[e.plate, e.account?.name, e.note].filter(Boolean).join(" · ")}</div>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-warn">{e.kind === "CHARGE" ? `${formatNumber(e.amount)} ${e.currency}` : ""}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-accent">{e.kind === "PAYMENT" ? `${formatNumber(e.amount)} ${e.currency}` : ""}</td>
                  <td className={`whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums ${e.debt > 0 ? "text-bad" : ""}`}>{formatNumber(e.debt)} {e.currency}</td>
                  {canEdit && <td className="px-3 py-2 text-right print:hidden"><CancelLessorEntryButton d={d} id={e.id} /></td>}
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-5 text-muted">{t("common.none")}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {canEdit && (
        <details className="card p-5 print:hidden">
          <summary className="cursor-pointer font-semibold text-accent">{t("common.edit")}</summary>
          <div className="mt-4"><LessorForm d={d} id={l.id} lessor={{ name: l.name, phone: l.phone ?? "", inn: l.inn ?? "", note: l.note ?? "" }} /></div>
        </details>
      )}
    </div>
  );
}
