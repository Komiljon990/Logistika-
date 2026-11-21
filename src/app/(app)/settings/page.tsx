import Link from "next/link";
import { getT } from "@/i18n";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/roles";

/**
 * Sozlamalar: asosiy menyudan olib qo'yilgan bo'limlar (tashkilot hujjatlari, xodimlar, valyutalar) va kassa sozlamalari.
 * Har band foydalanuvchi huquqiga qarab ko'rsatiladi; sahifalarning o'zi ham huquqni qayta tekshiradi.
 */
export default async function SettingsPage() {
  const user = await requirePermission("data.view");
  const t = await getT();
  const items = [
    { href: "/org-docs", title: t("nav.orgDocs"), hint: t("settings.orgDocsHint") },
    ...(can(user.role, "team.view") ? [{ href: "/team", title: t("nav.team"), hint: t("settings.teamHint") }] : []),
    { href: "/currencies", title: t("nav.currencies"), hint: t("settings.currenciesHint") },
    { href: "/settings/cash", title: t("settings.cash"), hint: t("settings.cashHint") },
    ...(can(user.role, "billing.manage") ? [{ href: "/settings/subscription", title: t("sub.title"), hint: t("sub.settingsHint") }] : []),
    { href: "/account", title: t("acc.title"), hint: t("settings.accountHint") },
  ];
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className="card grid gap-1 p-5 hover:border-accent">
            <span className="text-lg font-semibold text-accent">{it.title}</span>
            <span className="text-sm text-muted">{it.hint}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
