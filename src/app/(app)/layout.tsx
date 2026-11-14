import Link from "next/link";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { DemoNotice } from "@/components/DemoNotice";
import { Logo } from "@/components/Logo";
import { ThemeToggle, type ThemePref } from "@/components/ThemeToggle";
import { getT } from "@/i18n";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/roles";
import { countAlerts } from "@/lib/alerts";
import { tashkentToday } from "@/lib/docs";
import { logout } from "@/app/actions";
import { LangSwitch } from "@/components/LangSwitch";
import { HeaderLinks } from "@/components/HeaderLinks";
import { cashEnabled } from "@/lib/cash";
import { Nav } from "./Nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const t = await getT();
  const themeCookie = (await cookies()).get("theme")?.value;
  const themePref: ThemePref = themeCookie === "light" || themeCookie === "dark" ? themeCookie : "system";
  const alertCount = can(user.role, "alerts.badge") ? await countAlerts(user, tashkentToday()) : 0;
  // Kassa bo'limi tashkilot sozlamasiga qarab ko'rinadi; barcha tashkilotlar foydalanuvchisi uchun doim (tashkilot tanlaydi).
  const showCash = user.orgId ? await cashEnabled(user.orgId) : true;
  const items = [
    { href: "/", label: t("nav.home") },
    { href: "/trips", label: t("nav.trips") },
    { href: "/clients", label: t("nav.clients") },
    { href: "/settlements", label: t("nav.settlements") },
    ...(showCash ? [{ href: "/cash", label: t("nav.cash") }] : []),
    { href: "/vehicles", label: t("nav.vehicles") },
    { href: "/drivers", label: t("nav.drivers") },
    ...(["nav.tir", "nav.reports"] as const).map((k) => ({
      label: t(k),
      soon: t("nav.soon"),
    })),
    ...(can(user.role, "admin.access")
      ? [
          { href: "/admin/orgs", label: t("nav.orgs") },
          { href: "/admin/users", label: t("nav.users") },
        ]
      : []),
  ];
  const headerLinks = [
    { href: "/alerts", label: t("nav.alerts"), icon: "bell" as const, badge: alertCount },
    { href: "/activity", label: t("act.title"), icon: "history" as const },
    { href: "/settings", label: t("settings.title"), icon: "gear" as const, match: ["/org-docs", "/team", "/currencies"] },
  ];
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-paper px-4 py-2.5 shadow-sm">
        <Link href="/" aria-label={t("appName")}><Logo name={t("appName")} /></Link>
        <span className="text-sm text-muted">{user.orgName ?? t("home.allOrgs")}</span>
        <span className="flex-1" />
        <HeaderLinks items={headerLinks} />
        <ThemeToggle initial={themePref} labels={{ system: t("theme.system"), light: t("theme.light"), dark: t("theme.dark") }} />
        <LangSwitch />
        <span className="text-sm text-muted">{t(`role.${user.role}`)} · {user.fullName}</span>
        <form action={logout}><button className="text-sm text-accent hover:underline">{t("logout")}</button></form>
      </header>
      {user.isDemo && (
        <Suspense fallback={null}>
          <DemoNotice text={t("demo.banner")} blocked={t("demo.blocked")} />
        </Suspense>
      )}
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="card self-start p-2 md:sticky md:top-20"><Nav items={items} /></aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
