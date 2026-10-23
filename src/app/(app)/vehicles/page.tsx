import Link from "next/link";
import type { Prisma, VehicleType } from "@prisma/client";
import { getDict, getT } from "@/i18n";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { can, isGlobalRole } from "@/lib/roles";
import { orgScope } from "@/lib/scope";
import { normalizePlate } from "@/lib/docs";
import { StatusPill } from "@/components/StatusPill";
import { ExpiryPill } from "@/components/ExpiryPill";
import { VehicleForm } from "../fleet-forms";

const TYPES: VehicleType[] = ["TRACTOR", "TRAILER", "TRAIN", "OTHER"];

export default async function VehiclesPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; archived?: string; org?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [t, d] = [await getT(), await getDict()];
  const global = isGlobalRole(user.role);
  const type = TYPES.includes(sp.type as VehicleType) ? (sp.type as VehicleType) : undefined;
  const where: Prisma.VehicleWhereInput = {
    ...orgScope(user, sp.org),
    status: sp.archived ? "ARCHIVED" : "ACTIVE",
    ...(type ? { type } : {}),
    ...(sp.q ? { OR: [{ plate: { contains: normalizePlate(sp.q) } }, { model: { contains: sp.q, mode: "insensitive" } }] } : {}),
  };
  const vehicles = await db.vehicle.findMany({
    where,
    orderBy: [{ type: "asc" }, { plate: "asc" }],
    include: {
      org: { select: { name: true } },
      pairTrailer: { select: { plate: true } },
      pairDriver: { select: { fullName: true } },
      documents: { where: { status: "ACTIVE", expiresAt: { not: null } }, orderBy: { expiresAt: "asc" }, take: 1, select: { expiresAt: true } },
    },
  });
  const orgs = global ? await db.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) : [];
  const canEdit = can(user.role, "data.edit");
  return (
    <div className="grid gap-5">
      <h1 className="text-2xl font-bold">{t("veh.title")}</h1>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder={t("common.search")} aria-label={t("common.search")} className="input w-auto min-w-0 flex-1 basis-40" />
        <select name="type" defaultValue={type ?? ""} aria-label={t("veh.type")} className="input w-auto">
          <option value="">{t("veh.type")}: —</option>
          {TYPES.map((x) => <option key={x} value={x}>{t(`veh.type.${x}`)}</option>)}
        </select>
        {global && (
          <select name="org" defaultValue={sp.org ?? ""} aria-label={t("common.org")} className="input w-auto">
            <option value="">{t("home.allOrgs")}</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
        <label className="flex items-center gap-2 px-2 text-sm">
          <input type="checkbox" name="archived" value="1" defaultChecked={!!sp.archived} /> {t("common.showArchived")}
        </label>
        <button className="btn-ghost">{t("common.search")}</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">{t("veh.plate")}</th>
              <th className="px-4 py-2 font-medium">{t("veh.type")}</th>
              <th className="px-4 py-2 font-medium">{t("veh.model")}</th>
              <th className="px-4 py-2 font-medium">{t("veh.pair")}</th>
              <th className="px-4 py-2 font-medium">{t("doc.title")}</th>
              {global && <th className="px-4 py-2 font-medium">{t("common.org")}</th>}
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={v.id} className="border-t border-line">
                <td className="whitespace-nowrap px-4 py-2.5 font-medium tabular-nums">
                  <Link href={`/vehicles/${v.id}`} className="text-accent hover:underline">{v.plate}</Link>
                  {v.status !== "ACTIVE" && <span className="ml-2"><StatusPill status={v.status} t={t} /></span>}
                </td>
                <td className="px-4 py-2.5">{t(`veh.type.${v.type}`)}{v.ownership === "LEASED" && <span className="text-muted"> · {t("veh.own.LEASED")}</span>}</td>
                <td className="px-4 py-2.5">{v.model ?? "—"}</td>
                <td className="px-4 py-2.5 text-muted">{[v.pairTrailer?.plate, v.pairDriver?.fullName].filter(Boolean).join(" · ") || "—"}</td>
                <td className="px-4 py-2.5"><ExpiryPill expiresAt={v.documents[0]?.expiresAt ?? null} t={t} /></td>
                {global && <td className="px-4 py-2.5">{v.org.name}</td>}
              </tr>
            ))}
            {vehicles.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-muted">{t("common.none")}</td></tr>}
          </tbody>
        </table>
      </div>
      {canEdit && (
        <section className="card grid gap-4 p-5">
          <h2 className="text-lg font-semibold">{t("veh.new")}</h2>
          <VehicleForm d={d} />
        </section>
      )}
    </div>
  );
}
