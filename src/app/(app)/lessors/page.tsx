import Link from "next/link";
import { getDict, getT } from "@/i18n";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/session";
import { canEdit as canEditSection } from "@/lib/access";
import { orgScope } from "@/lib/scope";
import { formatNumber } from "@/lib/currency-core";
import { formatPhone } from "@/lib/phone";
import { lessorBalances } from "@/lib/lessors-core";
import { LessorForm } from "./forms";

/** Ijarachilar bilan hisob-kitob: har ijarachi bo'yicha hisoblangan, to'langan va qarz (valyuta bo'yicha). */
export default async function LessorsPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const user = await requireSection("lessors");
  const { all } = await searchParams;
  const [t, d] = [await getT(), await getDict()];
  const canEdit = canEditSection(user, "lessors");
  const lessors = await db.lessor.findMany({
    where: { ...orgScope(user), ...(all ? {} : { status: "ACTIVE" }) },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: { entries: { where: { status: "ACTIVE" }, select: { kind: true, amount: true, currency: true } } },
  });
  const rows = lessors.map((l) => ({ l, bal: lessorBalances(l.entries.map((e) => ({ kind: e.kind, amount: Number(e.amount), currency: e.currency }))) }));
  const totals: Record<string, number> = {};
  for (const { bal } of rows) for (const [cur, b] of Object.entries(bal)) totals[cur] = Math.round(((totals[cur] ?? 0) + b.debt) * 100) / 100;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{t("lessor.title")}</h1>
        <span className="flex-1" />
        <Link href={all ? "/lessors" : "/lessors?all=1"} className="text-sm text-accent hover:underline">{all ? t("common.hideArchived") : t("common.showArchived")}</Link>
      </div>
      <p className="text-sm text-muted">{t("lessor.hint")}</p>
      {Object.keys(totals).length > 0 && (
        <section className="flex flex-wrap gap-3">
          {Object.entries(totals).map(([cur, v]) => (
            <div key={cur} className="card px-4 py-3">
              <div className="text-xs text-muted">{t("lessor.totalDebt")}, {cur}</div>
              <div className={`text-2xl font-bold tabular-nums ${v > 0 ? "text-bad" : ""}`}>{formatNumber(v)}</div>
            </div>
          ))}
        </section>
      )}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">{t("lessor.name")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("lessor.charged")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("settle.paid")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("lessor.debt")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ l, bal }) => {
              const curs = Object.keys(bal);
              return (
                <tr key={l.id} className={`border-t border-line align-top ${l.status === "ACTIVE" ? "" : "text-muted"}`}>
                  <td className="px-4 py-2.5">
                    <Link href={`/lessors/${l.id}`} className="font-semibold text-accent hover:underline">{l.name}</Link>
                    {l.phone && <div className="text-xs tabular-nums text-muted">{formatPhone(l.phone)}</div>}
                  </td>
                  {(["charged", "paid", "debt"] as const).map((k) => (
                    <td key={k} className="px-4 py-2.5 text-right tabular-nums">
                      {curs.length ? curs.map((c) => (
                        <div key={c} className={k === "debt" && bal[c].debt > 0 ? "font-semibold text-bad" : ""}>{formatNumber(bal[c][k])} {c}</div>
                      )) : "—"}
                    </td>
                  ))}
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-muted">{t("common.none")}</td></tr>}
          </tbody>
        </table>
      </div>
      {canEdit && (
        <details className="card p-5">
          <summary className="cursor-pointer font-semibold text-accent">+ {t("lessor.new")}</summary>
          <div className="mt-4"><LessorForm d={d} /></div>
        </details>
      )}
    </div>
  );
}
