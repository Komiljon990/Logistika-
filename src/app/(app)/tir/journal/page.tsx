import Link from "next/link";
import type { PermitMoveKind, PermitType } from "@prisma/client";
import { getT } from "@/i18n";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { orgScope } from "@/lib/scope";
import { formatDate } from "@/lib/dates";
import { tashkentToday } from "@/lib/docs";
import { parsePeriod } from "@/lib/cash-core";
import { PrintButton } from "@/components/PrintButton";
import { PeriodFilter } from "../../cash/PeriodFilter";

const KINDS: PermitMoveKind[] = ["RECEIVED", "ISSUED", "RETURNED", "SURRENDERED", "LOST"];
type SP = { month?: string; from?: string; to?: string; k?: string; t?: string };

/** TIR / dazvol harakatlari jurnali: kirim, berildi, qaytarildi, topshirildi — davr bo'yicha ro'yxat. */
export default async function PermitJournalPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const t = await getT();
  const today = tashkentToday().toISOString().slice(0, 10);
  const period = parsePeriod(today, sp);
  const kind = KINDS.includes(sp.k as PermitMoveKind) ? (sp.k as PermitMoveKind) : null;
  const type = sp.t === "TIR" || sp.t === "DAZVOL" ? (sp.t as PermitType) : null;
  const moves = await db.permitMove.findMany({
    where: {
      ...orgScope(user), date: { gte: new Date(period.from), lte: new Date(period.to) },
      ...(kind ? { kind } : {}), ...(type ? { permit: { type } } : {}),
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    include: { permit: { select: { id: true, number: true, type: true, country: true, format: true } } },
    take: 2000,
  });
  const totals = new Map<PermitMoveKind, number>();
  for (const m of moves) totals.set(m.kind, (totals.get(m.kind) ?? 0) + 1);
  return (
    <div className="grid gap-6">
      <Link href="/tir" className="text-sm text-accent hover:underline print:hidden">← {t("nav.tir")}</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{t("tir.journal")}: {formatDate(new Date(period.from))} — {formatDate(new Date(period.to))}</h1>
        <span className="flex-1" />
        <PrintButton label={t("common.print")} />
      </div>
      <div className="print:hidden">
        <PeriodFilter
          t={t} org={null} period={period}
          extra={
            <>
              <select name="t" defaultValue={type ?? ""} aria-label={t("tir.type")} className="input w-auto">
                <option value="">{t("tir.allTypes")}</option>
                <option value="TIR">{t("tir.t.TIR")}</option>
                <option value="DAZVOL">{t("tir.t.DAZVOL")}</option>
              </select>
              <select name="k" defaultValue={kind ?? ""} aria-label={t("tir.moveKind")} className="input w-auto">
                <option value="">{t("tir.allMoves")}</option>
                {KINDS.map((k) => <option key={k} value={k}>{t(`tir.m.${k}`)}</option>)}
              </select>
            </>
          }
        />
      </div>
      <p className="flex flex-wrap gap-x-4 text-sm">
        {KINDS.map((k) => <span key={k}>{t(`tir.m.${k}`)}: <b className="tabular-nums">{totals.get(k) ?? 0}</b></span>)}
      </p>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">{t("pay.date")}</th>
              <th className="px-3 py-2 font-medium">{t("tir.number")}</th>
              <th className="px-3 py-2 font-medium">{t("tir.moveKind")}</th>
              <th className="px-3 py-2 font-medium">{t("trip.tractor")}</th>
              <th className="px-3 py-2 font-medium">{t("trip.driver")}</th>
              <th className="px-3 py-2 font-medium">{t("common.note")}</th>
            </tr>
          </thead>
          <tbody>
            {moves.map((m) => (
              <tr key={m.id} className="border-t border-line align-top">
                <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatDate(m.date)}</td>
                <td className="px-3 py-2">
                  <Link href={`/tir/${m.permit.id}`} className="font-mono text-accent hover:underline">{m.permit.number}</Link>
                  <div className="text-xs text-muted">{t(`tir.t.${m.permit.type}`)}{m.permit.format ? ` (${t(`tir.f.${m.permit.format}`)})` : ""}{m.permit.country ? ` · ${m.permit.country}` : ""}</div>
                </td>
                <td className="px-3 py-2">
                  {t(`tir.m.${m.kind}`)}{m.used !== null ? <span className="text-xs text-muted"> · {m.used ? t("tir.usedYes") : t("tir.usedNo")}</span> : null}
                  {m.ack && <div className={`text-xs ${m.ack === "REJECTED" ? "font-semibold text-bad" : m.ack === "CONFIRMED" ? "text-accent" : "text-warn"}`}>{t(`tir.ack.${m.ack}`)}</div>}
                </td>
                <td className="px-3 py-2 tabular-nums">{m.plate ?? ""}</td>
                <td className="px-3 py-2">{m.driverName ?? ""}</td>
                <td className="px-3 py-2 text-muted">{m.note ?? ""}</td>
              </tr>
            ))}
            {moves.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-muted">{t("common.none")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
