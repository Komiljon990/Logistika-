import { getDict, getT } from "@/i18n";
import { requireSection } from "@/lib/session";
import { canEdit as canEditSection } from "@/lib/access";
import { orgScope } from "@/lib/scope";
import { tashkentToday } from "@/lib/docs";
import { LedgerList } from "./LedgerList";
import { activeCurrencies } from "@/lib/org-currency";
import { monthOptions } from "@/lib/lessors-core";
import { BulkMembershipForm, NewLessorForm } from "./forms";

/**
 * Ijarachilar = "o'z transportida" toifali haydovchilar (Haydovchilar bo'limidagilar shu yerda ham ko'rinadi):
 * har biri bo'yicha transportlari, hisoblangan, to'langan va qarz (valyuta bo'yicha).
 */
export default async function LessorsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireSection("lessors");
  const { q } = await searchParams;
  const [t, d] = [await getT(), await getDict()];
  const canEdit = canEditSection(user, "lessors");
  const today = tashkentToday().toISOString().slice(0, 10);
  const currencies = canEdit ? await activeCurrencies(user.orgId!) : [];
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold">{t("lessor.title")}</h1>
      <p className="text-sm text-muted">{t("lessor.hint")}</p>
      <form className="card flex flex-wrap items-center gap-2 p-3">
        <input name="q" defaultValue={q} placeholder={t("lessor.search")} aria-label={t("common.search")} className="input w-auto min-w-0 flex-1 basis-48" />
        <button className="btn-ghost">{t("common.search")}</button>
      </form>
      <LedgerList t={t} orgWhere={orgScope(user)} side="LESSOR" q={q?.trim()} file={`${t("lessor.title")} ${tashkentToday().toISOString().slice(0, 10)}`} />
      {canEdit && (
        <details className="card p-5">
          <summary className="cursor-pointer font-semibold text-accent">{t("lessor.bulkTitle")}</summary>
          <p className="mt-2 text-xs text-muted">{t("lessor.bulkHint")}</p>
          <div className="mt-4"><BulkMembershipForm d={d} currencies={currencies} months={monthOptions(today)} today={today} /></div>
        </details>
      )}
      {canEdit && (
        <details className="card p-5">
          <summary className="cursor-pointer font-semibold text-accent">+ {t("lessor.new")}</summary>
          <div className="mt-4"><NewLessorForm d={d} /></div>
        </details>
      )}
    </div>
  );
}
