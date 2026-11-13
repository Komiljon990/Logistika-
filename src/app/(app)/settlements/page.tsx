import Link from "next/link";
import { getDict, getT } from "@/i18n";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/roles";
import { orgScope, seesAllOrgs } from "@/lib/scope";
import { formatDate } from "@/lib/dates";
import { tashkentToday } from "@/lib/docs";
import { crossRate, formatNumber } from "@/lib/currency-core";
import { ensureRates, rateMap } from "@/lib/rates";
import { balancesByClient, loadLedger } from "@/lib/settlement";
import { HandOverButton } from "./forms";

function sumBy(rows: { currency: string; value: number }[]) {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.currency] = (out[r.currency] ?? 0) + r.value;
  return Object.entries(out).filter(([, v]) => Math.abs(v) > 0.005);
}

/** Mijozlar bilan hisob-kitob: qarz, avans, haydovchilardagi naqd, bu oy tushum. */
export default async function SettlementsPage({ searchParams }: { searchParams: Promise<{ q?: string; all?: string; org?: string }> }) {
  const user = await requirePermission("data.view");
  const sp = await searchParams;
  const [t, d] = [await getT(), await getDict()];
  const global = seesAllOrgs(user);
  const scope = orgScope(user, sp.org);
  const today = tashkentToday().toISOString().slice(0, 10);
  await ensureRates([today], today);
  const [{ shipments, payments }, rates, clients, orgs] = await Promise.all([
    loadLedger(scope),
    rateMap(today),
    db.client.findMany({ where: scope, select: { id: true, name: true, inn: true, org: { select: { name: true } } } }),
    global ? db.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  const balances = balancesByClient(shipments, payments);
  const all = [...balances.entries()].flatMap(([, b]) => Object.entries(b).map(([currency, x]) => ({ currency, ...x })));
  const debts = sumBy(all.map((x) => ({ currency: x.currency, value: Math.max(0, x.debt) })));
  const advances = sumBy(all.map((x) => ({ currency: x.currency, value: x.advance })));
  const toUsd = (pairs: [string, number][]) => pairs.reduce((s, [c, v]) => s + v * (crossRate(rates, c, "USD") ?? 0), 0);
  const driverCash = payments.filter((p) => p.active && p.receivedBy === "DRIVER" && !p.handedOverAt);
  const month = today.slice(0, 7);
  const monthPays = payments.filter((p) => p.active && p.date.toISOString().slice(0, 7) === month);
  const monthTotals = sumBy(monthPays.map((p) => ({ currency: p.currency, value: p.amount })));
  const clientName = new Map(clients.map((c) => [c.id, c]));
  const q = sp.q?.trim().toLowerCase();
  const rows = [...balances.entries()]
    .map(([id, b]) => ({ id, client: clientName.get(id), b, debtAny: Object.values(b).some((x) => x.debt > 0.005) }))
    .filter((r) => r.client && (sp.all || r.debtAny) && (!q || r.client.name.toLowerCase().includes(q) || (r.client.inn ?? "").includes(q)))
    .sort((a, b) => toUsd(Object.entries(b.b).map(([c, x]) => [c, x.debt])) - toUsd(Object.entries(a.b).map(([c, x]) => [c, x.debt])));
  const money = (pairs: [string, number][]) => pairs.length ? pairs.map(([c, v]) => `${formatNumber(v)} ${c}`).join(" · ") : "0";

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold">{t("settle.title")}</h1>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        <div className="card p-4">
          <div className="text-xs text-muted">{t("settle.debt")}</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-bad">≈ {formatNumber(toUsd(debts))} USD</div>
          <div className="mt-1 text-sm tabular-nums">{money(debts)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-muted">{t("settle.advances")}</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-accent">≈ {formatNumber(toUsd(advances))} USD</div>
          <div className="mt-1 text-sm tabular-nums">{money(advances)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-muted">{t("settle.driverCash")}</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-warn">{money(sumBy(driverCash.map((p) => ({ currency: p.currency, value: p.amount }))))}</div>
          <div className="mt-1 text-sm">{driverCash.length} {t("settle.notHanded")}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-muted">{t("settle.thisMonth")}</div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{money(monthTotals)}</div>
          <div className="mt-1 text-sm">{monthPays.length} {t("settle.payments")}</div>
        </div>
      </div>

      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder={t("client.search")} aria-label={t("common.search")} className="input w-auto min-w-0 flex-1 basis-48" />
        {global && (
          <select name="org" defaultValue={sp.org ?? ""} aria-label={t("common.org")} className="input w-auto">
            <option value="">{t("home.allOrgs")}</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
        <label className="flex items-center gap-2 px-2 text-sm"><input type="checkbox" name="all" value="1" defaultChecked={!!sp.all} /> {t("settle.showAll")}</label>
        <button className="btn-ghost">{t("common.search")}</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">{t("trip.client")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("settle.charged")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("settle.paid")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("settle.advance")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("settle.debtCol")}</th>
              {global && <th className="px-4 py-2 font-medium">{t("common.org")}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const cur = Object.entries(r.b);
              return (
                <tr key={r.id} className="border-t border-line align-top">
                  <td className="px-4 py-3">
                    <Link href={`/clients/${r.id}`} className="font-semibold text-accent hover:underline">{r.client!.name}</Link>
                    {r.client!.inn && <div className="text-xs text-muted">{t("org.inn")} {r.client!.inn}</div>}
                  </td>
                  {(["charged", "paid", "advance", "debt"] as const).map((k) => (
                    <td key={k} className={`px-4 py-3 text-right tabular-nums ${k === "debt" ? "font-bold" : ""}`}>
                      {cur.map(([c, x]) => (
                        <div key={c} className={k === "debt" ? (x.debt > 0.005 ? "text-bad" : x.debt < -0.005 ? "text-accent" : "") : ""}>
                          {formatNumber(k === "debt" ? x.debt : x[k])} {c}
                        </div>
                      ))}
                    </td>
                  ))}
                  {global && <td className="px-4 py-3">{r.client!.org.name}</td>}
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-muted">{t("settle.none")}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">{t("settle.formula")}</p>

      {driverCash.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">{t("settle.driverCash")}</h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {driverCash.map((p) => (
                  <tr key={p.id} className="border-t border-line first:border-t-0">
                    <td className="px-4 py-2.5 font-medium">{p.driverName}</td>
                    <td className="px-4 py-2.5"><Link href={`/clients/${p.clientId}`} className="text-accent hover:underline">{clientName.get(p.clientId)?.name}</Link></td>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{formatDate(p.date)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums">{formatNumber(p.amount)} {p.currency}</td>
                    <td className="px-4 py-2.5 text-right">{can(user.role, "data.edit") && <HandOverButton d={d} paymentId={p.id} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
