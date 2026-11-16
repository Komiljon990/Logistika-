import Link from "next/link";
import { canEdit as canEditSection } from "@/lib/access";
import type { Prisma } from "@prisma/client";
import { getDict, getT } from "@/i18n";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/session";
import { orgScope, seesAllOrgs } from "@/lib/scope";
import { StatusPill } from "@/components/StatusPill";
import { ClientForm } from "../trips/forms";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; archived?: string; org?: string }> }) {
  const user = await requireSection("clients");
  const sp = await searchParams;
  const [t, d] = [await getT(), await getDict()];
  const global = seesAllOrgs(user);
  const where: Prisma.ClientWhereInput = {
    ...orgScope(user, sp.org),
    status: sp.archived ? "ARCHIVED" : "ACTIVE",
    ...(sp.q ? { OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { inn: { contains: sp.q } }] } : {}),
  };
  const clients = await db.client.findMany({
    where,
    orderBy: { name: "asc" },
    include: { org: { select: { name: true } }, _count: { select: { shipments: { where: { status: "ACTIVE" } } } } },
  });
  const orgs = global ? await db.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) : [];
  return (
    <div className="grid gap-5">
      <h1 className="text-2xl font-bold">{t("client.title")}</h1>
      <form className="card flex flex-wrap items-center gap-2 p-3">
        <input name="q" defaultValue={sp.q} placeholder={t("client.search")} aria-label={t("common.search")} className="input w-auto min-w-0 flex-1 basis-40" />
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
              <th className="px-4 py-2 font-medium">{t("client.name")}</th>
              <th className="px-4 py-2 font-medium">{t("org.inn")}</th>
              <th className="px-4 py-2 font-medium">{t("org.phone")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("client.shipments")}</th>
              {global && <th className="px-4 py-2 font-medium">{t("common.org")}</th>}
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="px-4 py-2.5">
                  <Link href={`/clients/${c.id}`} className="font-medium text-accent hover:underline">{c.name}</Link>
                  {c.status !== "ACTIVE" && <span className="ml-2"><StatusPill status={c.status} t={t} /></span>}
                </td>
                <td className="px-4 py-2.5 tabular-nums">{c.inn ?? "—"}</td>
                <td className="px-4 py-2.5 tabular-nums">{c.phone ?? "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{c._count.shipments}</td>
                {global && <td className="px-4 py-2.5">{c.org.name}</td>}
              </tr>
            ))}
            {clients.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-muted">{t("common.none")}</td></tr>}
          </tbody>
        </table>
      </div>
      {canEditSection(user, "clients") && (
        <section className="card grid gap-4 p-5">
          <h2 className="text-lg font-semibold">{t("client.new")}</h2>
          <ClientForm d={d} />
        </section>
      )}
    </div>
  );
}
