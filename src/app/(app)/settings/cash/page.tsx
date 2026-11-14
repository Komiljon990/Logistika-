import Link from "next/link";
import { getDict, getT } from "@/i18n";
import { can } from "@/lib/roles";
import { loadCategories } from "@/lib/cash";
import { cashContext } from "../../cash/context";
import { AddCategoryForm, CashToggle, CategoryRow } from "../../cash/forms";

/** Kassa sozlamalari: bo'limni yoqish/o'chirish va xarajat turkumlari (turkum › bo'lim). Rahbar o'zgartiradi. */
export default async function CashSettingsPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const sp = await searchParams;
  const ctx = await cashContext(sp.org);
  const [t, d] = [await getT(), await getDict()];
  const manage = can(ctx.user.role, "cash.settings") && !!ctx.user.orgId && ctx.org?.status === "ACTIVE";
  const categories = ctx.orgId ? await loadCategories(ctx.orgId, manage) : [];

  return (
    <div className="grid max-w-3xl gap-6">
      <Link href="/settings" className="text-sm text-accent hover:underline">← {t("settings.title")}</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{t("settings.cash")}</h1>
        <span className="flex-1" />
        {!ctx.user.orgId && (
          <form className="flex gap-2">
            <select name="org" defaultValue={ctx.orgId ?? ""} aria-label={t("common.org")} className="input w-auto">
              <option value="">{t("orgdoc.pickOrg")}</option>
              {ctx.orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <button className="btn-ghost">OK</button>
          </form>
        )}
      </div>
      {!manage && <p className="text-sm text-muted">{t("settings.cashViewOnly")}</p>}
      {!ctx.orgId ? (
        <p className="card px-4 py-6 text-sm text-muted">{t("orgdoc.pickOrg")}</p>
      ) : (
        <>
          <section className="card flex flex-wrap items-center gap-3 p-5">
            <div className="grid min-w-0 flex-1 gap-1">
              <span className="font-semibold">{t("settings.cashModule")}</span>
              <span className={`text-sm ${ctx.enabled ? "text-accent" : "text-muted"}`}>{ctx.enabled ? t("settings.cashOn") : t("settings.cashOff")}</span>
            </div>
            {manage && <CashToggle d={d} enabled={ctx.enabled} />}
          </section>

          <section className="card divide-y divide-line">
            <div className="grid gap-1 p-4">
              <h2 className="text-lg font-semibold">{t("settings.categories")}</h2>
              <p className="text-sm text-muted">{t("settings.categoriesHint")}</p>
            </div>
              {categories.map((c) => (
                <div key={c.id} className="grid gap-2 p-4">
                  {manage ? <CategoryRow d={d} id={c.id} name={c.name} active={c.active} strong /> : <span className="font-semibold">{c.name}</span>}
                  {c.active && (
                    <div className="grid gap-1.5 border-l-2 border-line pl-4 text-sm">
                      {c.children.map((s) => (manage ? <CategoryRow key={s.id} d={d} id={s.id} name={s.name} active={s.active} /> : <span key={s.id}>{s.name}</span>))}
                      {manage && <AddCategoryForm d={d} parentId={c.id} placeholder={t("settings.newSub")} />}
                    </div>
                  )}
                </div>
              ))}
              {manage && (
                <div className="p-4">
                  <AddCategoryForm d={d} parentId={null} placeholder={t("settings.newCategory")} />
                </div>
              )}
          </section>
        </>
      )}
    </div>
  );
}
