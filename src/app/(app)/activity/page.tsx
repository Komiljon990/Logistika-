import Link from "next/link";
import { getT } from "@/i18n";
import type { Dict } from "@/i18n";
import { requireUser } from "@/lib/session";
import { loadActivity } from "@/lib/activity";
import { UndoButton } from "./UndoButton";

const TZ_MS = 5 * 3_600_000; // Toshkent, UTC+5

function tashkent(d: Date) {
  const iso = new Date(d.getTime() + TZ_MS).toISOString();
  return { day: `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`, time: iso.slice(11, 16) };
}

/** Oxirgi amallar: kim, qachon, nima qildi; yozuvni ochish (tahrirlash) va yaratilgan yozuvni o'chirish (bekor qilish). */
export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ mine?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const t = await getT();
  const orgWide = user.role === "DIRECTOR" && !!user.orgId;
  const mineOnly = !orgWide || sp.mine === "1";
  const rows = await loadActivity(user, mineOnly, (type, title) => title ?? t(`doc.t.${type}` as keyof Dict) ?? type);
  const label = (action: string) => t(`act.${action}` as keyof Dict) ?? action;

  let lastDay = "";
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{t("act.title")}</h1>
        <span className="flex-1" />
        {orgWide && (
          <nav className="card flex gap-1 p-1 text-sm font-medium">
            <Link href="/activity" aria-current={!mineOnly ? "page" : undefined} className={`rounded-lg px-3 py-1.5 ${!mineOnly ? "bg-accent-soft text-accent" : "hover:bg-ground"}`}>{t("act.all")}</Link>
            <Link href="/activity?mine=1" aria-current={mineOnly ? "page" : undefined} className={`rounded-lg px-3 py-1.5 ${mineOnly ? "bg-accent-soft text-accent" : "hover:bg-ground"}`}>{t("act.mine")}</Link>
          </nav>
        )}
      </div>
      <p className="text-sm text-muted">{orgWide ? t("act.hintDirector") : t("act.hint")}</p>
      <div className="card divide-y divide-line">
        {rows.map((r) => {
          const { day, time } = tashkent(r.at);
          const head = day !== lastDay ? day : null;
          lastDay = day;
          return (
            <div key={r.id}>
              {head && <div className="bg-ground px-4 py-1.5 text-xs font-semibold text-muted">{head}</div>}
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-sm">
                <span className="w-12 shrink-0 tabular-nums text-muted">{time}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{label(r.action)}</span>
                  {r.text && <> · {r.href ? <Link href={r.href} className="text-accent hover:underline">{r.text}</Link> : r.text}</>}
                  {r.active === false && <span className="ml-2 rounded-full bg-ground px-2 py-0.5 text-xs text-muted">{t("act.inactive")}</span>}
                  {!mineOnly && r.actorName && <span className="block text-xs text-muted">{r.actorName}</span>}
                </span>
                {r.href && r.active !== false && <Link href={r.href} className="text-sm text-accent hover:underline">{t("act.open")}</Link>}
                {r.canUndo && <UndoButton id={r.id} label={t("common.delete")} confirm={t("act.undoConfirm")} errorText={t("act.error.undo")} />}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <p className="p-4 text-sm text-muted">{t("act.none")}</p>}
      </div>
    </div>
  );
}
