import Link from "next/link";
import { getT } from "@/i18n";
import { requireUser } from "@/lib/session";
import { globalSearch } from "@/lib/search";

/** Global qidiruv sahifasi. Qidiruvning o'zi src/lib/search.ts da (Telegram bot ham shuni ishlatadi). */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const t = await getT();
  const raw = ((await searchParams).q ?? "").trim().slice(0, 80);
  const q = raw;
  const groups = await globalSearch(user, q, t);
  const total = groups.reduce((s, g) => s + g.hits.length, 0);
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold">{t("search.title")}</h1>
      <form action="/search" className="card flex flex-wrap items-center gap-2 p-3">
        <input name="q" defaultValue={raw} autoFocus placeholder={t("search.placeholder")} aria-label={t("common.search")} className="input w-auto min-w-0 flex-1 basis-56" />
        <button className="btn">{t("common.search")}</button>
      </form>
      {q.length > 0 && q.length < 2 && <p className="text-sm text-muted">{t("search.min")}</p>}
      {q.length >= 2 && total === 0 && <p className="card px-4 py-6 text-sm text-muted">{t("search.none")}</p>}
      {groups.filter((g) => g.hits.length).map((g) => (
        <section key={g.key} className="grid gap-2">
          <h2 className="text-lg font-semibold">{g.title} <span className="text-sm font-normal text-muted">({g.hits.length})</span></h2>
          <div className="card divide-y divide-line">
            {g.hits.map((h) => (
              <Link key={h.href} href={h.href} className="block px-4 py-2.5 text-sm hover:bg-ground">
                <span className="font-semibold text-accent">{h.title}</span>
                {h.sub && <span className="block text-xs text-muted">{h.sub}</span>}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
