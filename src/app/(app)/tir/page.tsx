import Link from "next/link";
import type { PermitStatus, PermitType, Prisma } from "@prisma/client";
import { getDict, getT } from "@/i18n";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/roles";
import { orgScope } from "@/lib/scope";
import { formatDate } from "@/lib/dates";
import { tashkentToday } from "@/lib/docs";
import { daysTo, PERMIT_STATUSES } from "@/lib/permits-core";
import { AckBadge, PermitActions, ReceivePanel } from "./forms";

type SP = { s?: string; t?: string; q?: string };

const TONE: Record<PermitStatus, string> = {
  STOCK: "border-accent text-accent",
  ISSUED: "border-warn text-warn",
  USED: "border-bad text-bad",
  SURRENDERED: "border-line text-muted",
  LOST: "border-line text-muted line-through",
};

/** TIR karnetlar va dazvollar: tashkilotda, haydovchida, ishlatilgan (topshirilishi kerak), topshirilgan. */
export default async function TirPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [t, d] = [await getT(), await getDict()];
  // Demo va "faqat ko'rish" sessiyasi ham formani ko'radi (saqlash serverda to'xtatiladi) — boshqa bo'limlar kabi.
  const canEdit = can(user.role, "data.edit");
  const status = PERMIT_STATUSES.includes(sp.s as PermitStatus) ? (sp.s as PermitStatus) : null;
  const type = sp.t === "TIR" || sp.t === "DAZVOL" ? (sp.t as PermitType) : null;
  const q = (sp.q ?? "").trim().toUpperCase().slice(0, 40);
  const scope = orgScope(user);
  const where: Prisma.PermitWhereInput = {
    ...scope,
    ...(status ? { status } : { status: { in: ["STOCK", "ISSUED", "USED"] } }),
    ...(type ? { type } : {}),
    ...(q ? { number: { contains: q } } : {}),
  };
  const today = tashkentToday().toISOString().slice(0, 10);
  const [permits, counts, vehicles, drivers] = await Promise.all([
    db.permit.findMany({
      where, orderBy: [{ status: "asc" }, { type: "asc" }, { number: "asc" }], take: 500,
      include: {
        vehicle: { select: { plate: true } }, driver: { select: { fullName: true, telegramChatId: true } },
        moves: { orderBy: { createdAt: "desc" }, take: 1, select: { kind: true, ack: true, driverId: true } },
      },
    }),
    db.permit.groupBy({ by: ["type", "status"], where: scope, _count: true }),
    canEdit ? db.vehicle.findMany({ where: { ...scope, status: "ACTIVE", type: "TRACTOR" }, orderBy: { plate: "asc" }, select: { id: true, plate: true, pairDriverId: true } }) : [],
    canEdit ? db.driver.findMany({ where: { ...scope, status: "ACTIVE" }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }) : [],
  ]);
  const count = (ty: PermitType, st: PermitStatus) => counts.find((c) => c.type === ty && c.status === st)?._count ?? 0;
  const link = (extra: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged = { s: status, t: type, q: q || null, ...extra };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/tir${p.size ? `?${p}` : ""}`;
  };
  // Haydovchi bot orqali rad etgan (oxirgi harakat) blankalar — menejer e'tiboriga.
  const rejected = await db.permit.findMany({
    where: { ...scope, status: { in: ["STOCK", "ISSUED", "USED"] }, moves: { some: { ack: "REJECTED" } } },
    select: { id: true, number: true, moves: { orderBy: { createdAt: "desc" }, take: 1, select: { ack: true, kind: true, driverName: true } } },
  }).then((list) => list.filter((p) => p.moves[0]?.ack === "REJECTED"));
  const linkedDrivers = new Set(
    (await db.driver.findMany({ where: { ...scope, id: { in: permits.flatMap((p) => p.moves.map((m) => m.driverId ?? "")).filter(Boolean) }, telegramChatId: { not: null } }, select: { id: true } })).map((x) => x.id),
  );
  const pair = Object.fromEntries(vehicles.filter((v) => v.pairDriverId).map((v) => [v.id, v.pairDriverId!]));

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{t("nav.tir")}</h1>
        <span className="flex-1" />
        <Link href="/tir/journal" className="btn-ghost">{t("tir.journal")}</Link>
      </div>
      {!canEdit && <p className="text-sm text-muted">{t("tir.managerOnly")}</p>}

      {rejected.length > 0 && (
        <section className="card grid gap-1 border-bad bg-bad-soft p-4 text-sm">
          <span className="font-semibold text-bad">{t("tir.rejectedTitle")}</span>
          {rejected.map((p) => (
            <Link key={p.id} href={`/tir/${p.id}`} className="text-accent hover:underline">
              {p.number} — {p.moves[0].driverName ?? ""}: {t(p.moves[0].kind === "ISSUED" ? "tir.rejectedIssue" : "tir.rejectedReturn")}
            </Link>
          ))}
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        {(["TIR", "DAZVOL"] as const).map((ty) => (
          <div key={ty} className="card grid gap-2 p-4">
            <span className="font-semibold">{t(`tir.t.${ty}`)}</span>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              {(["STOCK", "ISSUED", "USED"] as const).map((st) => (
                <Link key={st} href={link({ s: st, t: ty })} className="rounded-lg border border-line p-2 hover:border-accent">
                  <div className="text-2xl font-bold tabular-nums">{count(ty, st)}</div>
                  <div className="text-xs text-muted">{t(`tir.s.${st}`)}</div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>

      {canEdit && (
        <ReceivePanel d={d} today={today} title={t("tir.receiveTitle")} />
      )}

      <div className="grid gap-3">
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link href={link({ s: null })} className={!status ? "btn" : "btn-ghost"}>{t("tir.open")}</Link>
          {PERMIT_STATUSES.map((st) => <Link key={st} href={link({ s: st })} className={status === st ? "btn" : "btn-ghost"}>{t(`tir.s.${st}`)}</Link>)}
        </nav>
        <form className="flex flex-wrap items-end gap-2">
          {status && <input type="hidden" name="s" value={status} />}
          <select name="t" defaultValue={type ?? ""} aria-label={t("tir.type")} className="input w-auto">
            <option value="">{t("tir.allTypes")}</option>
            <option value="TIR">{t("tir.t.TIR")}</option>
            <option value="DAZVOL">{t("tir.t.DAZVOL")}</option>
          </select>
          <input name="q" defaultValue={q} placeholder={t("tir.searchNumber")} aria-label={t("tir.searchNumber")} className="input w-48" />
          <button className="btn-ghost">{t("common.search")}</button>
        </form>
      </div>

      <div className="card divide-y divide-line">
        {permits.map((p) => {
          const left = p.status === "STOCK" || p.status === "ISSUED" ? daysTo(p.validUntil?.toISOString().slice(0, 10) ?? null, today) : null;
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/tir/${p.id}`} className="font-mono font-semibold text-accent hover:underline">{p.number}</Link>
                  <span className="text-xs text-muted">{t(`tir.t.${p.type}`)}{p.country ? ` · ${p.country}` : ""}{p.kind ? ` · ${p.kind}` : ""}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${TONE[p.status]}`}>{t(`tir.s.${p.status}`)}</span>
                  {p.moves[0] && (p.moves[0].kind === "ISSUED" || p.moves[0].kind === "RETURNED") && (
                    <AckBadge d={d} ack={p.moves[0].ack} linked={!!p.moves[0].driverId && linkedDrivers.has(p.moves[0].driverId)} />
                  )}
                  {left !== null && left <= 30 && <span className={`text-xs font-semibold ${left < 0 ? "text-bad" : "text-warn"}`}>{left < 0 ? t("tir.expired") : t("tir.daysLeft").replace("{n}", String(left))}</span>}
                </div>
                <div className="text-xs text-muted">
                  {p.status === "ISSUED" && p.vehicle && p.driver ? `${p.vehicle.plate} · ${p.driver.fullName} · ${formatDate(p.issuedAt)}` : `${t("tir.receivedAt")}: ${formatDate(p.receivedAt)}`}
                  {p.validUntil ? ` · ${t("tir.validUntil")}: ${formatDate(p.validUntil)}` : ""}
                  {p.issuer ? ` · ${p.issuer}` : ""}
                </div>
              </div>
              {canEdit && (
                <PermitActions
                  d={d} id={p.id} status={p.status} today={today} pair={pair}
                  vehicles={vehicles.map((v) => ({ id: v.id, label: v.plate }))}
                  drivers={drivers.map((x) => ({ id: x.id, label: x.fullName }))}
                />
              )}
            </div>
          );
        })}
        {permits.length === 0 && <p className="px-4 py-6 text-sm text-muted">{t("common.none")}</p>}
      </div>
    </div>
  );
}
