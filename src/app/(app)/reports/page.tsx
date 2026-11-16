import Link from "next/link";
import { getT, type T } from "@/i18n";
import { requireSection } from "@/lib/session";
import { orgForWrite } from "@/lib/scope";
import { formatNumber } from "@/lib/currency-core";
import { formatDate } from "@/lib/dates";
import { tashkentToday } from "@/lib/docs";
import { parsePeriod } from "@/lib/cash-core";
import { cashEnabled } from "@/lib/cash";
import { expensesReport, financeReport, permitsReport, tripsReport, type Money, type TripGroup } from "@/lib/reports";
import { PrintButton } from "@/components/PrintButton";
import { PeriodFilter } from "../cash/PeriodFilter";

const TABS = ["trips", "finance", "expenses", "tir", "dazvol"] as const;
type Tab = (typeof TABS)[number];
type SP = { r?: string; month?: string; from?: string; to?: string };

function M({ m, tone }: { m: Money; tone?: "good" | "bad" }) {
  const e = Object.entries(m).filter(([, v]) => v !== 0);
  if (!e.length) return <span className="text-muted">—</span>;
  return (
    <span className="grid justify-items-end">
      {e.map(([cur, v]) => (
        <span key={cur} className={`whitespace-nowrap tabular-nums ${tone === "good" ? "text-accent" : tone === "bad" ? "text-bad" : v < 0 ? "text-bad" : ""}`}>{formatNumber(v)} {cur}</span>
      ))}
    </span>
  );
}

function GroupTable({ t, title, rows, first }: { t: T; title: string; rows: TripGroup[]; first: string }) {
  return (
    <section className="grid gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">{first}</th>
              <th className="px-3 py-2 text-right font-medium">{t("rep.trips")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("rep.revenue")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.key} className="border-t border-line align-top">
                <td className="px-3 py-2">{g.label}</td>
                <td className="px-3 py-2 text-right tabular-nums">{g.trips}</td>
                <td className="px-3 py-2 text-right"><M m={g.revenue} /></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={3} className="px-3 py-5 text-muted">{t("common.none")}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Hisobotlar: reyslar (transport, haydovchi, mijoz, yo'nalish), pul oqimi, xarajatlar, TIR/dazvol. Davr — oy yoki sana oralig'i. */
export default async function ReportsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireSection("reports");
  const sp = await searchParams;
  const t = await getT();
  const orgId = orgForWrite(user);
  const today = tashkentToday().toISOString().slice(0, 10);
  const period = parsePeriod(today, sp);
  const cash = await cashEnabled(orgId);
  const tabs = TABS.filter((x) => cash || (x !== "finance" && x !== "expenses"));
  const tab: Tab = tabs.includes(sp.r as Tab) ? (sp.r as Tab) : "trips";
  const keep: Record<string, string> = period.month ? { month: period.month } : { from: period.from, to: period.to };
  const href = (r: Tab) => `/reports?${new URLSearchParams({ r, ...keep })}`;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{t("nav.reports")}</h1>
        <span className="text-muted">{formatDate(new Date(period.from))} — {formatDate(new Date(period.to))}</span>
        <span className="flex-1" />
        <PrintButton label={t("common.print")} />
      </div>
      <nav className="card flex gap-1 overflow-x-auto p-1.5 text-sm font-medium print:hidden">
        {tabs.map((x) => (
          <Link key={x} href={href(x)} aria-current={tab === x ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-3.5 py-2 ${tab === x ? "bg-accent-soft font-semibold text-accent" : "text-ink hover:bg-ground"}`}>
            {t(`rep.tab.${x}`)}
          </Link>
        ))}
      </nav>
      <div className="print:hidden"><PeriodFilter t={t} org={null} period={period} extra={<input type="hidden" name="r" value={tab} />} /></div>
      <h2 className="hidden text-xl font-bold print:block">{t(`rep.tab.${tab}`)}</h2>

      {tab === "trips" && <TripsTab t={t} orgId={orgId} from={period.from} to={period.to} />}
      {tab === "finance" && <FinanceTab t={t} orgId={orgId} from={period.from} to={period.to} />}
      {tab === "expenses" && <ExpensesTab t={t} orgId={orgId} from={period.from} to={period.to} />}
      {tab === "tir" && <PermitsTab t={t} orgId={orgId} from={period.from} to={period.to} type="TIR" />}
      {tab === "dazvol" && <PermitsTab t={t} orgId={orgId} from={period.from} to={period.to} type="DAZVOL" />}
    </div>
  );
}

async function TripsTab({ t, orgId, from, to }: { t: T; orgId: string; from: string; to: string }) {
  const r = await tripsReport(orgId, from, to);
  return (
    <>
      <section className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <div className="card p-4"><div className="text-xs text-muted">{t("rep.trips")}</div><div className="text-2xl font-bold tabular-nums">{r.count}</div><div className="text-xs text-muted">{t("rep.completed")}: {r.completed}</div></div>
        <div className="card p-4"><div className="text-xs text-muted">{t("rep.revenue")}</div><div className="text-xl font-bold"><M m={r.total} /></div></div>
      </section>
      <p className="text-xs text-muted">{t("rep.tripsHint")}</p>
      <GroupTable t={t} title={t("rep.byTractor")} rows={r.byTractor} first={t("trip.tractor")} />
      <GroupTable t={t} title={t("rep.byDriver")} rows={r.byDriver} first={t("trip.driver")} />
      <GroupTable t={t} title={t("rep.byClient")} rows={r.byClient} first={t("rep.client")} />
      <GroupTable t={t} title={t("rep.byRoute")} rows={r.routes} first={t("rep.route")} />
      <Link href="/settlements" className="text-sm text-accent hover:underline print:hidden">{t("rep.debtsLink")} →</Link>
    </>
  );
}

async function FinanceTab({ t, orgId, from, to }: { t: T; orgId: string; from: string; to: string }) {
  const r = await financeReport(orgId, from, to);
  const cols = [
    ["payments", "rep.f.payments", "good"], ["otherIn", "rep.f.otherIn", "good"], ["expenses", "rep.f.expenses", "bad"],
    ["otherOut", "rep.f.otherOut", "bad"], ["toUntracked", "rep.f.toUntracked", "bad"], ["net", "rep.f.net", undefined],
  ] as const;
  const monthName = (m: string) => `${m.slice(5, 7)}.${m.slice(0, 4)}`;
  return (
    <section className="grid gap-2">
      <p className="text-xs text-muted">{t("rep.financeHint")}</p>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">{t("cash.month")}</th>
              {cols.map(([k, label]) => <th key={k} className="px-3 py-2 text-right font-medium">{t(label)}</th>)}
            </tr>
          </thead>
          <tbody>
            {r.rows.map((row) => (
              <tr key={row.month} className="border-t border-line align-top">
                <td className="px-3 py-2 tabular-nums">{monthName(row.month)}</td>
                {cols.map(([k, , tone]) => <td key={k} className="px-3 py-2 text-right"><M m={row[k]} tone={tone} /></td>)}
              </tr>
            ))}
            {r.rows.length === 0 && <tr><td colSpan={7} className="px-3 py-5 text-muted">{t("common.none")}</td></tr>}
            {r.rows.length > 0 && (
              <tr className="border-t-2 border-line bg-ground font-semibold align-top">
                <td className="px-3 py-2">{t("cash.total")}</td>
                {cols.map(([k, , tone]) => <td key={k} className="px-3 py-2 text-right"><M m={r.total[k]} tone={tone} /></td>)}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

async function ExpensesTab({ t, orgId, from, to }: { t: T; orgId: string; from: string; to: string }) {
  const r = await expensesReport(orgId, from, to);
  return (
    <section className="grid gap-2">
      <div className="card divide-y divide-line">
        {r.rows.map((c) => (
          <div key={c.name} className="grid gap-1 px-4 py-3 text-sm">
            <div className="flex items-start gap-3"><span className="flex-1 font-semibold">{c.name}</span><span className="font-semibold"><M m={c.total} /></span></div>
            {c.children.map((ch) => (
              <div key={ch.name} className="flex items-start gap-3 pl-4 text-muted"><span className="flex-1">{ch.name}</span><M m={ch.total} /></div>
            ))}
          </div>
        ))}
        {r.rows.length === 0 && <p className="px-4 py-5 text-sm text-muted">{t("common.none")}</p>}
        {r.rows.length > 0 && (
          <div className="flex items-start gap-3 bg-ground px-4 py-3 text-sm font-semibold">
            <span className="flex-1">{t("cash.total")} ({r.count})</span><M m={r.total} />
          </div>
        )}
      </div>
    </section>
  );
}

async function PermitsTab({ t, orgId, from, to, type }: { t: T; orgId: string; from: string; to: string; type: "TIR" | "DAZVOL" }) {
  const r = await permitsReport(orgId, from, to, type);
  const count = (fm: string | null, st: string) => r.status.filter((s) => s.status === st && (fm === "ALL" || s.format === fm)).reduce((a, s) => a + s._count, 0);
  // Dazvol: qog'oz va elektron alohida qator + jami; TIR: bitta qator.
  const rows: { key: string; label: string; fm: string | null }[] = type === "TIR"
    ? [{ key: "TIR", label: t("tir.title.TIR"), fm: "ALL" }]
    : [
        { key: "PAPER", label: t("tir.f.PAPER"), fm: "PAPER" },
        { key: "ELECTRONIC", label: t("tir.f.ELECTRONIC"), fm: "ELECTRONIC" },
        { key: "ALL", label: t("cash.total"), fm: "ALL" },
      ];
  const base = type === "TIR" ? "/tir" : "/dazvol";
  return (
    <>
      <section className="grid gap-2">
        <h2 className="text-lg font-semibold">{t("rep.permitMoves")}</h2>
        <p className="flex flex-wrap gap-x-5 text-sm">
          {(["RECEIVED", "ISSUED", "RETURNED", "SURRENDERED", "LOST"] as const).map((k) => (
            <span key={k}>{t(`tir.m.${k}`)}: <b className="tabular-nums">{r.moves.find((m) => m.kind === k)?._count ?? 0}</b></span>
          ))}
        </p>
      </section>
      <section className="grid gap-2">
        <h2 className="text-lg font-semibold">{t("rep.permitNow")}</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">{t("tir.type")}</th>
                {(["STOCK", "ISSUED", "USED", "SURRENDERED", "LOST"] as const).map((s) => <th key={s} className="px-3 py-2 text-right font-medium">{t(`tir.s.${s}`)}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className={`border-t border-line ${row.key === "ALL" ? "bg-ground font-semibold" : ""}`}>
                  <td className="px-3 py-2">{row.label}</td>
                  {(["STOCK", "ISSUED", "USED", "SURRENDERED", "LOST"] as const).map((s) => <td key={s} className="px-3 py-2 text-right tabular-nums">{count(row.fm, s)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="grid gap-2">
        <h2 className="text-lg font-semibold">{t("rep.permitByDriver")}</h2>
        <div className="card divide-y divide-line">
          {r.byDriver.map(([name, v]) => (
            <div key={name} className="flex gap-3 px-4 py-2.5 text-sm"><span className="flex-1">{name}</span><span className="font-semibold tabular-nums">{v}</span></div>
          ))}
          {r.byDriver.length === 0 && <p className="px-4 py-5 text-sm text-muted">{t("common.none")}</p>}
        </div>
      </section>
      <Link href={`${base}/journal?from=${from}&to=${to}`} className="text-sm text-accent hover:underline print:hidden">{t("tir.journal")} →</Link>
    </>
  );
}
