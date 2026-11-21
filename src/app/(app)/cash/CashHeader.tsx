import Link from "next/link";
import type { T } from "@/i18n";
import type { CashContext } from "./context";

const TABS = [
  { href: "/cash", key: "cash.tab.overview" },
  { href: "/cash/expenses", key: "cash.tab.expenses" },
  { href: "/cash/entries", key: "cash.tab.entries" },
  { href: "/cash/transfers", key: "cash.tab.transfers" },
  { href: "/cash/accounts", key: "cash.tab.accounts" },
] as const;

/**
 * Kassa bo'limi sarlavhasi: tashkilot tanlovi (barcha tashkilotlar foydalanuvchisi uchun) va bo'lim yorliqlari.
 * Tashkilot tanlanmagan yoki kassa o'chirilgan bo'lsa — tushuntirish qaytaradi (sahifa mazmuni ko'rsatilmaydi).
 */
export function CashHeader({ ctx, t, active }: { ctx: CashContext; t: T; active: (typeof TABS)[number]["href"] }) {
  const qs = ctx.q ? `?${ctx.q}` : "";
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{t("cash.title")}</h1>
        {ctx.user.orgId && ctx.org && <span className="text-muted">{ctx.org.name}</span>}
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
      {ctx.orgId && ctx.enabled && (
        <nav className="card flex gap-1 overflow-x-auto p-1.5 text-sm font-medium" aria-label={t("cash.title")}>
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={`${tab.href}${qs}`}
              aria-current={active === tab.href ? "page" : undefined}
              className={`whitespace-nowrap rounded-lg px-3.5 py-2 ${active === tab.href ? "bg-accent-soft font-semibold text-accent" : "text-ink hover:bg-ground"}`}
            >
              {t(tab.key)}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

/** Kassa sahifasini ko'rsatib bo'lmaydigan holat: tashkilot tanlanmagan yoki bo'lim o'chirilgan. */
export function CashUnavailable({ ctx, t }: { ctx: CashContext; t: T }) {
  if (!ctx.orgId) return <p className="card px-4 py-6 text-sm text-muted">{t("orgdoc.pickOrg")}</p>;
  if (!ctx.enabled) return <p className="card px-4 py-6 text-sm text-muted">{t("cash.disabled")}</p>;
  return null;
}
