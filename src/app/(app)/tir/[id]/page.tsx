import Link from "next/link";
import { canEdit as canEditSection } from "@/lib/access";
import { notFound } from "next/navigation";
import { getDict, getT } from "@/i18n";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/session";
import { orgScope } from "@/lib/scope";
import { formatDate } from "@/lib/dates";
import { tashkentToday } from "@/lib/docs";
import { AckBadge, CancelIssueButton, DeletePermitButton, PermitActions } from "../forms";
import { PERMIT_BASE } from "../PermitsList";

/** Bitta TIR / dazvol: ma'lumotlar va to'liq harakatlar tarixi. */
export default async function PermitPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSection("tir");
  const { id } = await params;
  const [t, d] = [await getT(), await getDict()];
  const p = await db.permit.findFirst({
    where: { id, ...orgScope(user) },
    include: { moves: { orderBy: [{ date: "asc" }, { createdAt: "asc" }] }, vehicle: { select: { plate: true } }, driver: { select: { fullName: true } } },
  });
  if (!p) notFound();
  const canEdit = canEditSection(user, "tir");
  const last = p.moves[p.moves.length - 1];
  const driverIds = [...new Set(p.moves.map((m) => m.driverId).filter((x): x is string => !!x))];
  const linked = new Set((await db.driver.findMany({ where: { id: { in: driverIds }, telegramChatId: { not: null } }, select: { id: true } })).map((x) => x.id));
  const today = tashkentToday().toISOString().slice(0, 10);
  const [vehicles, drivers] = canEdit && p.status === "STOCK"
    ? await Promise.all([
        db.vehicle.findMany({ where: { orgId: p.orgId, status: "ACTIVE", type: "TRACTOR" }, orderBy: { plate: "asc" }, select: { id: true, plate: true, pairDriverId: true } }),
        db.driver.findMany({ where: { orgId: p.orgId, status: "ACTIVE" }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
      ])
    : [[], []];
  const rows: [string, string][] = [
    [t("tir.type"), `${t(`tir.t.${p.type}`)}${p.format ? ` (${t(`tir.f.${p.format}`)})` : ""}`],
    ...(p.country ? [[t("tir.country"), p.country] as [string, string]] : []),
    ...(p.kind ? [[p.type === "DAZVOL" ? t("tir.kindDazvol") : t("tir.kindTir"), p.kind] as [string, string]] : []),
    ...(p.issuer ? [[t("tir.issuer"), p.issuer] as [string, string]] : []),
    [t("tir.receivedAt"), formatDate(p.receivedAt)],
    [t("tir.validUntil"), formatDate(p.validUntil)],
    ...(p.status === "ISSUED" && p.vehicle && p.driver ? [[t("tir.holder"), `${p.vehicle.plate} · ${p.driver.fullName} (${formatDate(p.issuedAt)})`] as [string, string]] : []),
    ...(p.note ? [[t("common.note"), p.note] as [string, string]] : []),
  ];
  return (
    <div className="grid max-w-3xl gap-6">
      <Link href={PERMIT_BASE[p.type]} className="text-sm text-accent hover:underline">← {t(`tir.title.${p.type}`)}</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-2xl font-bold">{p.number}</h1>
        <span className="rounded-full border border-line px-2.5 py-0.5 text-xs">{t(`tir.s.${p.status}`)}</span>
        <span className="flex-1" />
        {canEdit && (
          <PermitActions
            d={d} id={p.id} status={p.status} today={today}
            pair={Object.fromEntries(vehicles.filter((v) => v.pairDriverId).map((v) => [v.id, v.pairDriverId!]))}
            vehicles={vehicles.map((v) => ({ id: v.id, label: v.plate }))} drivers={drivers.map((x) => ({ id: x.id, label: x.fullName }))}
          />
        )}
      </div>
      <section className="card p-5">
        <dl className="grid gap-2 text-sm sm:grid-cols-[180px_1fr]">
          {rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd>{v}</dd></div>)}
        </dl>
      </section>
      <section className="grid gap-2">
        <h2 className="text-lg font-semibold">{t("tir.history")}</h2>
        <ol className="card divide-y divide-line">
          {p.moves.map((m) => (
            <li key={m.id} className="px-4 py-3 text-sm">
              <span className="tabular-nums text-muted">{formatDate(m.date)}</span> · <span className="font-semibold">{t(`tir.m.${m.kind}`)}</span>
              {m.plate || m.driverName ? <span> · {[m.plate, m.driverName].filter(Boolean).join(" · ")}</span> : null}
              {m.used !== null && <span className="text-muted"> · {m.used ? t("tir.usedYes") : t("tir.usedNo")}</span>}
              {(m.kind === "ISSUED" || m.kind === "RETURNED") && m.driverId && (
                <span className="ml-2"><AckBadge d={d} ack={m.ack} linked={linked.has(m.driverId)} /></span>
              )}
              {m.ackAt && <span className="text-xs text-muted"> {formatDate(m.ackAt)}</span>}
              {m.note && <div className="text-xs text-muted">{m.note}</div>}
            </li>
          ))}
        </ol>
      </section>
      {canEdit && p.status === "ISSUED" && last?.kind === "ISSUED" && last.ack === "REJECTED" && (
        <section className="card grid gap-2 border-bad p-4 text-sm">
          <p>{t("tir.rejectedHint")}</p>
          <CancelIssueButton d={d} id={p.id} />
        </section>
      )}
      {canEdit && p.status === "STOCK" && p.moves.length === 1 && <DeletePermitButton d={d} id={p.id} />}
    </div>
  );
}
