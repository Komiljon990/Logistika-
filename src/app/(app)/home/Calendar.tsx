import Link from "next/link";
import type { T } from "@/i18n";

/**
 * Oylik kalendar. Kun bosilsa shu sanadagi kurs ko'rsatiladi (?date=), oylar ?m= bilan almashadi.
 * Kelajakdagi kunlar bosilmaydi (kurs hali yo'q).
 */
export function Calendar({ t, today, selected, month }: { t: T; today: string; selected: string; month: string }) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // dushanbadan boshlanadi
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];
  while (cells.length % 7) cells.push(null);
  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    return d.toISOString().slice(0, 7);
  };
  const prev = shift(-1);
  const next = shift(1);
  const months = t("cal.months").split(",");
  const weekdays = t("cal.weekdays").split(",");
  const href = (q: Record<string, string>) => `/?${new URLSearchParams({ date: selected, m: month, ...q }).toString()}`;

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Link href={href({ m: prev })} aria-label={t("cal.prev")} className="grid size-11 place-items-center rounded-md hover:bg-ground">‹</Link>
        <div className="flex-1 text-center font-semibold">{months[m - 1]} {y}</div>
        {next <= today.slice(0, 7) ? (
          <Link href={href({ m: next })} aria-label={t("cal.next")} className="grid size-11 place-items-center rounded-md hover:bg-ground">›</Link>
        ) : (
          <span className="size-11" />
        )}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {weekdays.map((w) => <div key={w} className="py-1 text-xs text-muted">{w}</div>)}
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const n = Number(day.slice(8));
          const isSel = day === selected;
          const isToday = day === today;
          if (day > today) return <div key={day} className="grid h-10 place-items-center text-muted/50">{n}</div>;
          return (
            <Link
              key={day}
              href={href({ date: day })}
              aria-current={isSel ? "date" : undefined}
              className={`grid h-10 place-items-center rounded-md tabular-nums ${
                isSel ? "bg-accent font-semibold text-white" : isToday ? "ring-2 ring-accent ring-inset font-semibold" : "hover:bg-ground"
              }`}
            >
              {n}
            </Link>
          );
        })}
      </div>
      {selected !== today && (
        <Link href={`/?${new URLSearchParams({ date: today, m: today.slice(0, 7) }).toString()}`} className="mt-2 inline-block text-sm text-accent hover:underline">
          {t("cal.backToday")}
        </Link>
      )}
    </div>
  );
}
