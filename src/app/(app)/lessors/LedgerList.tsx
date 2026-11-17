import Link from "next/link";
import type { T } from "@/i18n";
import { db } from "@/lib/db";
import { formatNumber } from "@/lib/currency-core";
import { formatPhone } from "@/lib/phone";
import { lessorBalances } from "@/lib/lessors-core";
import { ExcelButton } from "@/components/ExcelButton";

/**
 * Haydovchilar ro'yxati hisob-kitobi bilan: ijarachilar (o'z transportidagilar) yoki xodim haydovchilar.
 * Faol haydovchilar va (arxivdagi bo'lsa ham) yozuvi borlar ko'rinadi.
 */
export async function LedgerList({ t, orgWhere, side, q, file }: { t: T; orgWhere: { orgId?: string }; side: "LESSOR" | "STAFF"; q?: string; file: string }) {
  const category = side === "LESSOR" ? "OWNER_OPERATOR" : "EMPLOYEE";
  const drivers = await db.driver.findMany({
    where: {
      ...orgWhere,
      OR: [{ category, status: "ACTIVE" }, { entries: { some: { side, status: "ACTIVE" } } }],
      ...(q ? { fullName: { contains: q, mode: "insensitive" as const } } : {}),
    },
    orderBy: { fullName: "asc" },
    include: {
      entries: { where: { side, status: "ACTIVE" }, select: { kind: true, amount: true, currency: true } },
      ownedVehicles: { where: { status: "ACTIVE" }, select: { id: true, plate: true } },
      pairedVehicles: { where: { status: "ACTIVE" }, select: { id: true, plate: true } },
    },
  });
  const base = side === "LESSOR" ? "/lessors" : "/settlements/drivers";
  const rows = drivers.map((dr) => ({ dr, bal: lessorBalances(dr.entries.map((e) => ({ kind: e.kind, amount: Number(e.amount), currency: e.currency }))) }));
  const totals: Record<string, number> = {};
  for (const { bal } of rows) for (const [cur, b] of Object.entries(bal)) totals[cur] = Math.round(((totals[cur] ?? 0) + b.debt) * 100) / 100;
  const debtLabel = side === "LESSOR" ? t("lessor.debt") : t("ledger.weOwe");

  return (
    <>
      {Object.keys(totals).length > 0 && (
        <section className="flex flex-wrap gap-3">
          {Object.entries(totals).map(([cur, v]) => (
            <div key={cur} className="card px-4 py-3">
              <div className="text-xs text-muted">{side === "LESSOR" ? t("lessor.totalDebt") : t("ledger.totalWeOwe")}, {cur}</div>
              <div className={`text-2xl font-bold tabular-nums ${v > 0 ? "text-bad" : ""}`}>{formatNumber(v)}</div>
            </div>
          ))}
        </section>
      )}
      <section className="grid gap-2">
        <div className="flex justify-end"><ExcelButton label={t("common.excel")} target="ledger-list" file={file} /></div>
        <div className="card overflow-x-auto">
          <table id="ledger-list" className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">{t("drv.fullName")}</th>
                <th className="px-4 py-2 font-medium">{side === "LESSOR" ? t("lessor.vehicles") : t("ledger.pairVehicles")}</th>
                <th className="px-4 py-2 text-right font-medium">{t("lessor.charged")}</th>
                <th className="px-4 py-2 text-right font-medium">{t("settle.paid")}</th>
                <th className="px-4 py-2 text-right font-medium">{debtLabel}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ dr, bal }) => {
                const curs = Object.keys(bal);
                const veh = side === "LESSOR" ? dr.ownedVehicles : dr.pairedVehicles;
                return (
                  <tr key={dr.id} className={`border-t border-line align-top ${dr.status === "ACTIVE" ? "" : "text-muted"}`}>
                    <td className="px-4 py-2.5">
                      <Link href={`${base}/${dr.id}`} className="font-semibold text-accent hover:underline">{dr.fullName}</Link>
                      {dr.phone && <div className="text-xs tabular-nums text-muted">{formatPhone(dr.phone)}</div>}
                    </td>
                    <td className="px-4 py-2.5">{veh.length ? veh.map((v) => v.plate).join(", ") : <span className="text-muted">—</span>}</td>
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
              {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-muted">{side === "LESSOR" ? t("lessor.none") : t("ledger.noDrivers")}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
