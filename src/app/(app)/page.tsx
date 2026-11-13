import Link from "next/link";
import { getT } from "@/i18n";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { isGlobalRole } from "@/lib/roles";
import { orgScope } from "@/lib/scope";
import { formatDate } from "@/lib/dates";
import { tashkentToday } from "@/lib/docs";
import { ExpiryPill } from "@/components/ExpiryPill";
import { loadAlerts } from "@/lib/alerts";
import { BASE, addDays, lastDays, parseDay } from "@/lib/currency-core";
import { activeCurrencies } from "@/lib/org-currency";
import { ensureRates, rateMap, rateSeries } from "@/lib/rates";
import { RatesTable } from "./home/RatesTable";
import { RateChart } from "./home/RateChart";
import { Calendar } from "./home/Calendar";
import { Calculator } from "./home/Calculator";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ date?: string; m?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const t = await getT();
  const scope = orgScope(user);
  const todayDate = tashkentToday();
  const today = todayDate.toISOString().slice(0, 10);
  const yesterday = addDays(today, -1);
  const picked = parseDay(sp.date);
  const selected = picked && picked <= today ? picked : today;
  const month = sp.m && /^\d{4}-\d{2}$/.test(sp.m) && sp.m <= today.slice(0, 7) ? sp.m : selected.slice(0, 7);
  const days = lastDays(today, 30);

  const codes = await activeCurrencies(user.orgId);
  const foreign = codes.filter((c) => c !== BASE);
  // Kurslar bazada bo'lmasa Markaziy bankdan olinadi (har kun bir marta).
  await ensureRates([...days, yesterday, selected], today);

  const [vehicles, drivers, alerts, orgCount, rToday, rYesterday, rSelected, series] = await Promise.all([
    db.vehicle.count({ where: { ...scope, status: "ACTIVE" } }),
    db.driver.count({ where: { ...scope, status: "ACTIVE" } }),
    loadAlerts(user, todayDate),
    isGlobalRole(user.role) ? db.organization.count({ where: { status: "ACTIVE" } }) : Promise.resolve(null),
    rateMap(today),
    rateMap(yesterday),
    rateMap(selected),
    rateSeries(foreign, days),
  ]);
  const expiringCount = alerts.length;
  const expiring = alerts.slice(0, 10);
  const selectedLabel = formatDate(new Date(`${selected}T00:00:00Z`));

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("home.title")}, {user.fullName}</h1>
        <p className="mt-1 text-muted">{user.orgName ?? t("home.allOrgs")}</p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        {orgCount !== null && <Kpi label={t("home.orgCount")} value={orgCount} />}
        <Kpi label={t("home.vehicles")} value={vehicles} href="/vehicles" />
        <Kpi label={t("home.drivers")} value={drivers} href="/drivers" />
        <Kpi label={t("home.expiring")} value={expiringCount} warn={expiringCount > 0} href="/alerts" />
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <section className="card grid min-w-0 flex-[999_1_480px] gap-5 p-5">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="text-lg font-semibold">{t("rates.title")}</h2>
            <span className="text-sm text-muted">{formatDate(todayDate)}</span>
            <span className="flex-1" />
            <Link href="/currencies" className="text-sm text-accent hover:underline">{t("nav.currencies")}</Link>
          </div>
          <RatesTable t={t} codes={foreign} today={rToday} yesterday={rYesterday} selected={rSelected} selectedDay={selected} isToday={selected === today} />
          <RateChart
            days={days}
            series={series}
            codes={foreign}
            labels={{ title: t("rates.chart"), currency: t("currency.code"), noData: t("rates.noData"), table: t("rates.asTable") }}
          />
        </section>
        <div className="grid min-w-0 flex-[1_1_320px] gap-6">
          <section className="card p-5">
            <h2 className="mb-3 text-lg font-semibold">{t("cal.title")}</h2>
            <Calendar t={t} today={today} selected={selected} month={month} />
          </section>
          <section className="card p-5">
            <Calculator
              key={selected}
              codes={codes}
              rates={rSelected}
              rateDateLabel={`${t("calc.rateDate")}: ${selectedLabel}`}
              labels={{
                title: t("calc.title"), rate: t("calc.rate"), cbu: t("calc.cbu"), manual: t("calc.manual"),
                reset: t("calc.reset"), swap: t("calc.swap"), amount: t("calc.amount"), noRate: t("calc.noRate"),
              }}
            />
          </section>
        </div>
      </div>
      {expiring.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">{t("home.expiringList")}</h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {expiring.map((x) => (
                  <tr key={x.key} className="border-t border-line first:border-t-0">
                    <td className="px-4 py-2.5"><Link href={x.href} className="text-accent hover:underline">{x.owner}</Link></td>
                    <td className="px-4 py-2.5">{x.title || (x.docType ? t(`doc.t.${x.docType}`) : t("alerts.lease"))}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{formatDate(x.expiresAt)}</td>
                    <td className="px-4 py-2.5"><ExpiryPill expiresAt={x.expiresAt} t={t} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Kpi({ label, value, href, warn }: { label: string; value: number; href?: string; warn?: boolean }) {
  const body = (
    <div className={`card px-4 py-3 ${warn ? "border-warn bg-warn-soft" : ""}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl tabular-nums">{value}</div>
    </div>
  );
  return href ? <Link href={href} className="hover:opacity-90">{body}</Link> : body;
}
