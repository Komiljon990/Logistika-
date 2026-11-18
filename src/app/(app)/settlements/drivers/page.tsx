import { getT } from "@/i18n";
import { requireSection } from "@/lib/session";
import { orgScope } from "@/lib/scope";
import { tashkentToday } from "@/lib/docs";
import { LedgerList } from "../../lessors/LedgerList";
import { SettleTabs } from "../SettleTabs";
import { canEdit } from "@/lib/access";
import { getDict } from "@/i18n";

/** Xodim haydovchilar bilan hisob-kitob: reys uchun va qo'shimcha hisob, to'lovlar, bizning qarzimiz. */
export default async function DriverSettlementsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireSection("settlements");
  const { q } = await searchParams;
  const [t, d] = [await getT(), await getDict()];
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold">{t("settle.title")}</h1>
      <SettleTabs t={t} user={user} active="drivers" />
      <p className="text-sm text-muted">{t("ledger.driversHint")}</p>
      <form className="card flex flex-wrap items-center gap-2 p-3">
        <input name="q" defaultValue={q} placeholder={t("lessor.search")} aria-label={t("common.search")} className="input w-auto min-w-0 flex-1 basis-48" />
        <button className="btn-ghost">{t("common.search")}</button>
      </form>
      <LedgerList t={t} d={d} canEdit={canEdit(user, "settlements")} orgWhere={orgScope(user)} side="STAFF" q={q?.trim()} file={`${t("ledger.driversTitle")} ${tashkentToday().toISOString().slice(0, 10)}`} />
    </div>
  );
}
