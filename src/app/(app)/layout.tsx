import Link from "next/link";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { DemoNotice } from "@/components/DemoNotice";
import { Logo } from "@/components/Logo";
import { ThemeToggle, type ThemePref } from "@/components/ThemeToggle";
import { getT } from "@/i18n";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/roles";
import { countAlerts } from "@/lib/alerts";
import { tashkentToday } from "@/lib/docs";
import { logout } from "@/app/actions";
import { LangSwitch } from "@/components/LangSwitch";
import { HeaderLinks } from "@/components/HeaderLinks";
import { cashEnabled } from "@/lib/cash";
import { db } from "@/lib/db";
import { reviewCount, todayDate } from "@/lib/billing";
import { Nav } from "./Nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();
  const t = await getT();
  const themeCookie = (await cookies()).get("theme")?.value;
  const themePref: ThemePref = themeCookie === "light" || themeCookie === "dark" ? themeCookie : "system";
  const member = !!user.orgId;
  const alertCount = member && can(user.role, "alerts.badge") ? await countAlerts(user, tashkentToday()) : 0;
  // Kassa bo'limi tashkilot sozlamasiga qarab ko'rinadi.
  const showCash = member && (await cashEnabled(user.orgId!));
  const accountLink = { href: "/account", label: t("acc.title"), icon: "user" as const };
  const fmt = new Intl.DateTimeFormat("uz-UZ", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Tashkent" });
  // Super Admin: faqat boshqaruv (tashkilotlar va rahbarlar), tashkilot ma'lumotlari menyusi yo'q.
  const [pendingApps, reviewInvoices] = member ? [0, 0] : await Promise.all([db.orgApplication.count({ where: { status: "PENDING" } }), reviewCount()]);
  // Obuna eslatmasi (rahbar va buxgalterga): to'lanmagan hisob yoki muddat tugashiga 7 kun qolgan/tugagan.
  let billingNote: string | null = null;
  if (member && can(user.role, "billing.manage") && !user.isDemo) {
    const [org, unpaid] = await Promise.all([
      db.organization.findUnique({ where: { id: user.orgId! }, select: { subEnd: true } }),
      db.invoice.count({ where: { orgId: user.orgId!, status: "UNPAID" } }),
    ]);
    const daysLeft = org?.subEnd ? Math.floor((org.subEnd.getTime() - todayDate().getTime()) / 86_400_000) : null;
    if (daysLeft !== null && daysLeft < 0) billingNote = t("sub.bannerExpired");
    else if (unpaid > 0) billingNote = t("sub.bannerUnpaid");
    else if (daysLeft !== null && daysLeft <= 7) billingNote = t("sub.bannerSoon").replace("{n}", String(daysLeft));
  }
  const withCount =(label: string, n: number) => (n > 0 ? `${label} (${n})` : label);
  const items = !member ? [
    { href: "/admin/orgs", label: t("nav.orgs") },
    { href: "/admin/applications", label: withCount(t("app.title"), pendingApps) },
    { href: "/admin/payments", label: withCount(t("inv.title"), reviewInvoices) },
    { href: "/admin/site", label: t("site.admin") },
    { href: "/admin/settings", label: t("set.title") },
  ] : [
    { href: "/", label: t("nav.home") },
    { href: "/trips", label: t("nav.trips") },
    { href: "/clients", label: t("nav.clients") },
    { href: "/settlements", label: t("nav.settlements") },
    ...(showCash ? [{ href: "/cash", label: t("nav.cash") }] : []),
    { href: "/vehicles", label: t("nav.vehicles") },
    { href: "/drivers", label: t("nav.drivers") },
    { href: "/tir", label: t("nav.tir") },
    { href: "/reports", label: t("nav.reports") },
  ];
  const headerLinks = !member ? [accountLink] : [
    { href: "/alerts", label: t("nav.alerts"), icon: "bell" as const, badge: alertCount },
    { href: "/activity", label: t("act.title"), icon: "history" as const },
    { href: "/settings", label: t("settings.title"), icon: "gear" as const, match: ["/org-docs", "/team", "/currencies"] },
    accountLink,
  ];
  const orgLabel = user.orgName ?? t("admin.panel");
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 print:hidden flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-paper px-4 py-2.5 shadow-sm">
        <Link href="/" aria-label={t("appName")}><Logo name={t("appName")} /></Link>
        {user.memberships > 1 ? (
          <Link href="/select-org" title={t("org.switch")} className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-sm hover:border-accent">
            {orgLabel} <span aria-hidden className="text-accent">⇄</span>
          </Link>
        ) : (
          <span className="text-sm text-muted">{orgLabel}</span>
        )}
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
      {user.grant && (
        <Suspense fallback={null}>
          <DemoNotice
            text={`${t(user.grant.mode === "EDIT" ? "acc.bannerEDIT" : "acc.bannerVIEW").replace("{name}", user.fullName)} ${t("acc.until")} ${fmt.format(user.grant.expiresAt)}.`}
            blocked={t("acc.viewBlocked")}
          />
        </Suspense>
      )}
      {billingNote && (
        <Link href="/settings/subscription" className="block bg-warn-soft px-4 print:hidden py-2 text-center text-sm text-warn hover:underline">{billingNote}</Link>
      )}
      {!user.isDemo && !user.grant && !user.email && (
        <Link href="/account" className="block bg-accent-soft px-4 py-2 text-center text-sm text-accent hover:underline">{t("acc.noEmailBanner")}</Link>
      )}
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="card self-start p-2 md:sticky md:top-20 print:hidden"><Nav items={items} /></aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
