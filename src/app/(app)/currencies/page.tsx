import { getDict, getT } from "@/i18n";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/roles";
import { BASE, formatNumber, rateDigits } from "@/lib/currency-core";
import { seedOrgCurrencies } from "@/lib/org-currency";
import { ensureRates, knownCurrencies, rateMap } from "@/lib/rates";
import { tashkentToday } from "@/lib/docs";
import { AddCurrencyForm, CurrencyToggle } from "./CurrencyForms";

/** Tashkilot valyutalari: rahbar qo'shadi va nofaol qiladi; boshqalar ko'radi. */
export default async function CurrenciesPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const user = await requirePermission("data.view");
  const sp = await searchParams;
  const [t, d] = [await getT(), await getDict()];
  const today = tashkentToday().toISOString().slice(0, 10);
  await ensureRates([today], today);

  const orgs = user.orgId ? [] : await db.organization.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const orgId = user.orgId ?? (orgs.some((o) => o.id === sp.org) ? sp.org! : null);
  if (orgId) await seedOrgCurrencies(orgId);
  const rows = orgId ? await db.orgCurrency.findMany({ where: { orgId }, orderBy: [{ active: "desc" }, { createdAt: "asc" }] }) : [];
  const [rates, known] = await Promise.all([rateMap(today), knownCurrencies()]);
  const names = new Map(known.map((k) => [k.code, k.name]));
  const manage = can(user.role, "currency.manage") && !!user.orgId;
  const activeCodes = new Set(rows.filter((r) => r.active).map((r) => r.code));

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{t("currency.title")}</h1>
        <span className="flex-1" />
        {!user.orgId && (
          <form className="flex gap-2">
            <select name="org" defaultValue={orgId ?? ""} aria-label={t("common.org")} className="input w-auto">
              <option value="">{t("orgdoc.pickOrg")}</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <button className="btn-ghost">OK</button>
          </form>
        )}
      </div>
      <p className="text-sm text-muted">{manage ? t("currency.hintManage") : t("currency.hintView")}</p>
      {!orgId ? (
        <p className="card px-4 py-6 text-sm text-muted">{t("orgdoc.pickOrg")}</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">{t("currency.code")}</th>
                <th className="px-4 py-2 font-medium">{t("common.name")}</th>
                <th className="px-4 py-2 text-right font-medium">{t("currency.rateToday")}</th>
                <th className="px-4 py-2 font-medium">{t("common.status")}</th>
                {manage && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const rate = r.code === BASE ? 1 : rates[r.code];
                return (
                  <tr key={r.id} className={`border-t border-line ${r.active ? "" : "text-muted"}`}>
                    <td className="px-4 py-2.5 font-semibold">{r.code}</td>
                    <td className="px-4 py-2.5">{r.code === BASE ? t("currency.uzs") : names.get(r.code) ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{rate ? `${formatNumber(rate, rateDigits(rate))} so'm` : "—"}</td>
                    <td className="px-4 py-2.5">{r.active ? t("status.ACTIVE") : t("currency.inactive")}</td>
                    {manage && (
                      <td className="px-4 py-2.5 text-right">
                        {r.code !== BASE && <CurrencyToggle d={d} code={r.code} active={r.active} />}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {manage && (
        <section className="card grid gap-3 p-5">
          <h2 className="text-lg font-semibold">{t("currency.add")}</h2>
          <AddCurrencyForm d={d} options={known.filter((k) => !activeCodes.has(k.code)).map((k) => ({ code: k.code, name: k.name ?? k.code }))} />
        </section>
      )}
    </div>
  );
}
