import type { T } from "@/i18n";

/**
 * Hisobot davri: oy yoki ixtiyoriy davr (sana dan — gacha). Ikkalasi to'ldirilsa, davr ustun.
 * Oddiy GET forma — havolani saqlab yoki ulashib bo'ladi.
 */
export function PeriodFilter({ t, org, period, account, accounts, extra }: {
  t: T; org: string | null; period: { from: string; to: string; month: string | null };
  account?: string; accounts?: { id: string; label: string }[]; extra?: React.ReactNode;
}) {
  return (
    <form className="card flex flex-wrap items-end gap-3 p-3">
      {org && <input type="hidden" name="org" value={org} />}
      <div>
        <label htmlFor="pf-month" className="label">{t("cash.month")}</label>
        <input id="pf-month" name="month" type="month" defaultValue={period.month ?? ""} className="input w-auto" />
      </div>
      <span className="pb-3 text-sm text-muted">{t("cash.or")}</span>
      <div>
        <label htmlFor="pf-from" className="label">{t("cash.from")}</label>
        <input id="pf-from" name="from" type="date" defaultValue={period.month ? "" : period.from} className="input w-auto" />
      </div>
      <div>
        <label htmlFor="pf-to" className="label">{t("cash.to")}</label>
        <input id="pf-to" name="to" type="date" defaultValue={period.month ? "" : period.to} className="input w-auto" />
      </div>
      {accounts && (
        <div className="min-w-0 flex-1 basis-48">
          <label htmlFor="pf-acc" className="label">{t("cash.account")}</label>
          <select id="pf-acc" name="account" defaultValue={account ?? ""} className="input">
            <option value="">{t("cash.allAccounts")}</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>
      )}
      {extra}
      <button className="btn">{t("cash.show")}</button>
    </form>
  );
}
