import Link from "next/link";
import { ExcelButton } from "@/components/ExcelButton";
import { getT } from "@/i18n";
import { requirePermission } from "@/lib/session";
import { formatDate } from "@/lib/dates";
import { tashkentToday } from "@/lib/docs";
import { groupAlerts, loadAlerts, type AlertGroup } from "@/lib/alerts";
import { ExpiryPill } from "@/components/ExpiryPill";

const GROUPS: AlertGroup[] = ["expired", "d7", "d15", "d30"];
const GROUP_STYLE: Record<AlertGroup, string> = {
  expired: "text-bad",
  d7: "text-bad",
  d15: "text-warn",
  d30: "text-warn",
};

/** Muddati o'tgan va 30 kun ichida tugaydigan hujjatlar va ijara shartnomalari. */
export default async function AlertsPage() {
  const user = await requirePermission("data.view");
  const t = await getT();
  const today = tashkentToday();
  const groups = groupAlerts(await loadAlerts(user, today), today);
  const total = GROUPS.reduce((n, g) => n + groups[g].length, 0);
  const showOrg = !user.orgId;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("alerts.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("alerts.hint")}</p>
      </div>
      {total === 0 && <p className="card px-4 py-6 text-sm text-muted">{t("alerts.none")}</p>}
      {GROUPS.filter((g) => groups[g].length > 0).map((g) => (
        <section key={g} className="grid gap-2">
          <h2 className={`text-lg font-semibold ${GROUP_STYLE[g]}`}>{t(`alerts.${g}`)} · {groups[g].length}</h2>
          <div className="card overflow-x-auto">
            <div className="flex justify-end border-b border-line px-3 py-1 print:hidden"><ExcelButton label={t("common.excel")} target="xl-alerts-page" file={t("nav.alerts")} /></div>
            <table id="xl-alerts-page" className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">{t("alerts.owner")}</th>
                  <th className="px-4 py-2 font-medium">{t("doc.type")}</th>
                  <th className="px-4 py-2 font-medium">{t("doc.number")}</th>
                  <th className="px-4 py-2 font-medium">{t("doc.expiresAt")}</th>
                  {showOrg && <th className="px-4 py-2 font-medium">{t("common.org")}</th>}
                </tr>
              </thead>
              <tbody>
                {groups[g].map((x) => (
                  <tr key={x.key} className="border-t border-line">
                    <td className="px-4 py-2.5">
                      <Link href={x.href} className="font-medium text-accent hover:underline">{x.owner}</Link>
                      <div className="text-xs text-muted">{t(`alerts.kind.${x.kind}`)}</div>
                    </td>
                    <td className="px-4 py-2.5">{x.title || (x.docType ? t(`doc.t.${x.docType}`) : t("alerts.lease"))}</td>
                    <td className="px-4 py-2.5 tabular-nums">{x.number ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">
                      {formatDate(x.expiresAt)} <span className="ml-1"><ExpiryPill expiresAt={x.expiresAt} t={t} /></span>
                    </td>
                    {showOrg && <td className="px-4 py-2.5">{x.orgName}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
