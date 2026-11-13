import type { T } from "@/i18n";
import { changePct, formatNumber, rateDigits, type RateMap } from "@/lib/currency-core";
import { formatDate } from "@/lib/dates";

/** Bugungi kurs, kechagiga nisbatan o'zgarish va tanlangan sanadagi kurs. */
export function RatesTable({ t, codes, today, yesterday, selected, selectedDay, isToday }: {
  t: T; codes: string[]; today: RateMap; yesterday: RateMap; selected: RateMap; selectedDay: string; isToday: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted">
          <tr>
            <th className="py-2 pr-3 font-medium">{t("currency.code")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("rates.today")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("rates.change")}</th>
            {!isToday && <th className="py-2 pl-3 text-right font-medium">{formatDate(new Date(`${selectedDay}T00:00:00Z`))}</th>}
          </tr>
        </thead>
        <tbody>
          {codes.map((c) => {
            const now = today[c];
            const prev = yesterday[c];
            const pct = changePct(now, prev);
            const diff = now && prev ? now - prev : null;
            const up = (diff ?? 0) > 0;
            const flat = !diff || Math.abs(diff) < 1e-9;
            return (
              <tr key={c} className="border-t border-line">
                <td className="py-2.5 pr-3 font-semibold">{c}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{now ? formatNumber(now, rateDigits(now)) : "—"}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                  {diff === null ? (
                    <span className="text-muted">—</span>
                  ) : flat ? (
                    <span className="text-muted">{t("rates.noChange")}</span>
                  ) : (
                    <span aria-label={up ? t("rates.up") : t("rates.down")}>
                      <span aria-hidden="true" className={up ? "text-accent" : "text-muted"}>{up ? "▲" : "▼"}</span>{" "}
                      {up ? "+" : "−"}{formatNumber(Math.abs(diff), rateDigits(Math.abs(now!)))}
                      <span className="ml-1 text-xs text-muted">({up ? "+" : "−"}{formatNumber(Math.abs(pct!), 2)}%)</span>
                    </span>
                  )}
                </td>
                {!isToday && (
                  <td className="py-2.5 pl-3 text-right tabular-nums">{selected[c] ? formatNumber(selected[c], rateDigits(selected[c])) : "—"}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">{t("rates.source")}</p>
    </div>
  );
}
