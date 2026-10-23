import Link from "next/link";
import type { DriverCategory, Prisma } from "@prisma/client";
import { getDict, getT } from "@/i18n";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { can, isGlobalRole } from "@/lib/roles";
import { orgScope } from "@/lib/scope";
import { formatPhone } from "@/lib/phone";
import { StatusPill } from "@/components/StatusPill";
import { ExpiryPill } from "@/components/ExpiryPill";
import { DriverForm } from "../fleet-forms";

const CATS: DriverCategory[] = ["EMPLOYEE", "OWNER_OPERATOR"];

export default async function DriversPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; archived?: string; org?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [t, d] = [await getT(), await getDict()];
  const global = isGlobalRole(user.role);
  const category = CATS.includes(sp.category as DriverCategory) ? (sp.category as DriverCategory) : undefined;
  const digits = sp.q?.replace(/\D/g, "");
  const where: Prisma.DriverWhereInput = {
    ...orgScope(user, sp.org),
    status: sp.archived ? "ARCHIVED" : "ACTIVE",
    ...(category ? { category } : {}),
    ...(sp.q ? { OR: [{ fullName: { contains: sp.q, mode: "insensitive" } }, ...(digits ? [{ phone: { contains: digits } }] : [])] } : {}),
  };
  const drivers = await db.driver.findMany({
    where,
    orderBy: { fullName: "asc" },
    include: {
      org: { select: { name: true } },
      pairedVehicles: { where: { status: "ACTIVE" }, select: { plate: true } },
      documents: { where: { status: "ACTIVE", expiresAt: { not: null } }, orderBy: { expiresAt: "asc" }, take: 1, select: { expiresAt: true } },
    },
  });
  const orgs = global ? await db.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) : [];
  return (
    <div className="grid gap-5">
      <h1 className="text-2xl font-bold">{t("drv.title")}</h1>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder={t("common.search")} aria-label={t("common.search")} className="input w-auto min-w-0 flex-1 basis-40" />
        <select name="category" defaultValue={category ?? ""} aria-label={t("drv.category")} className="input w-auto">
          <option value="">{t("drv.category")}: —</option>
          {CATS.map((x) => <option key={x} value={x}>{t(`drv.cat.${x}`)}</option>)}
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
              <th className="px-4 py-2 font-medium">{t("drv.fullName")}</th>
              <th className="px-4 py-2 font-medium">{t("drv.phone")}</th>
              <th className="px-4 py-2 font-medium">{t("drv.category")}</th>
              <th className="px-4 py-2 font-medium">{t("veh.title")}</th>
              <th className="px-4 py-2 font-medium">{t("doc.title")}</th>
              {global && <th className="px-4 py-2 font-medium">{t("common.org")}</th>}
            </tr>
          </thead>
          <tbody>
            {drivers.map((x) => (
              <tr key={x.id} className="border-t border-line">
                <td className="px-4 py-2.5">
                  <Link href={`/drivers/${x.id}`} className="text-accent hover:underline">{x.fullName}</Link>
                  {x.status !== "ACTIVE" && <span className="ml-2"><StatusPill status={x.status} t={t} /></span>}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{x.phone ? formatPhone(x.phone) : "—"}</td>
                <td className="px-4 py-2.5">{t(`drv.cat.${x.category}`)}</td>
                <td className="px-4 py-2.5 text-muted">{x.pairedVehicles.map((p) => p.plate).join(", ") || "—"}</td>
                <td className="px-4 py-2.5"><ExpiryPill expiresAt={x.documents[0]?.expiresAt ?? null} t={t} /></td>
                {global && <td className="px-4 py-2.5">{x.org.name}</td>}
              </tr>
            ))}
            {drivers.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-muted">{t("common.none")}</td></tr>}
          </tbody>
        </table>
      </div>
      {can(user.role, "data.edit") && (
        <section className="card grid gap-4 p-5">
          <h2 className="text-lg font-semibold">{t("drv.new")}</h2>
          <DriverForm d={d} />
        </section>
      )}
    </div>
  );
}
