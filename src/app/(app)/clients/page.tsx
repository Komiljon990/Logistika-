import Link from "next/link";
import { ExcelButton } from "@/components/ExcelButton";
import { canEdit as canEditSection, canView } from "@/lib/access";
import { balancesByClient, loadLedger } from "@/lib/settlement";
import { formatNumber } from "@/lib/currency-core";
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
  // 18.11.2026: qarz ustuni (Hisob-kitob bo'limini ko'ra oladiganlarga) — mijozlar va hisob-kitob bir joyda ko'rinadi.
  const showDebt = canView(user, "settlements");
  const balances = showDebt ? await loadLedger(orgScope(user, sp.org)).then(({ shipments, payments }) => balancesByClient(shipments, payments)) : null;
  const debtOf = (id: string) => Object.entries(balances?.get(id) ?? {}).filter(([, b]) => b.debt > 0.004);
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-2xl font-bold">{t("client.title")}</h1>
        {canEditSection(user, "clients") && <Link href="/import?kind=clients" className="btn-ghost">{t("imp.button")}</Link>}
      </div>
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
        <div className="flex justify-end border-b border-line px-3 py-1 print:hidden"><ExcelButton label={t("common.excel")} target="xl-clients-page" file={t("nav.clients")} /></div>
        <table id="xl-clients-page" className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">{t("client.name")}</th>
              <th className="px-4 py-2 font-medium">{t("org.inn")}</th>
              <th className="px-4 py-2 font-medium">{t("org.phone")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("client.shipments")}</th>
              {showDebt && <th className="px-4 py-2 text-right font-medium">{t("settle.debtCol")}</th>}
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
                {showDebt && (
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {debtOf(c.id).length ? debtOf(c.id).map(([cur, b]) => <div key={cur} className="whitespace-nowrap font-semibold text-bad">{formatNumber(b.debt)} {cur}</div>) : <span className="text-muted">—</span>}
                  </td>
                )}
                {global && <td className="px-4 py-2.5">{c.org.name}</td>}
              </tr>
            ))}
            {clients.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-muted">{t("common.none")}</td></tr>}
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
