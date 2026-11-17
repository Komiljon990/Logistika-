import Link from "next/link";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { DemoNotice } from "@/components/DemoNotice";
import { Logo } from "@/components/Logo";
import { ThemeToggle, type ThemePref } from "@/components/ThemeToggle";
import { getT } from "@/i18n";
import { homeFor, requireSession } from "@/lib/session";
import { can } from "@/lib/roles";
import { countAlerts } from "@/lib/alerts";
import { tashkentToday } from "@/lib/docs";
import { logout } from "@/app/actions";
import { LangSwitch } from "@/components/LangSwitch";
import { HeaderLinks } from "@/components/HeaderLinks";
import { cashEnabled } from "@/lib/cash";
import { db } from "@/lib/db";
import { reviewCount, todayDate } from "@/lib/billing";
import { canEdit, canView, roleTitle, type Section } from "@/lib/access";
import { getDict, type Dict } from "@/i18n";
import { QuickIncome } from "@/components/QuickIncome";
import { Nav } from "./Nav";

// "+ Kirim" oynasidagi matnlar (butun lug'at har sahifada brauzerga yuborilmasin).
const INCOME_KEYS = [
  "income.button", "income.title", "income.from", "income.src.client", "income.src.lessor", "income.src.other", "income.clientHint",
  "income.pickLessor", "income.noAccounts", "income.noRights", "income.saved", "income.another", "common.close", "common.loading",
  "common.save", "common.note", "trip.client", "trip.pickClient", "cash.party", "ledger.toAccount", "pay.pickAccount", "cash.amount",
  "currency.code", "pay.method", "pay.m.BANK", "pay.m.CASH", "pay.m.CARD", "pay.date",
  "income.error.client", "income.error.lessor", "cash.error.account", "pay.error.date", "pay.error.amount", "common.required",
  "trip.error.currency", "pay.error.method", "pay.error.over", "pay.error.exceed", "pay.error.rate", "lessor.error.type",
  "lessor.error.period", "lessor.error.trip", "demo.blocked",
] as const satisfies readonly (keyof Dict)[];

function pickDict(d: Dict, keys: readonly (keyof Dict)[]): Dict {
  return Object.fromEntries(keys.map((k) => [k, d[k]])) as Dict;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();
  const t = await getT();
  const themeCookie = (await cookies()).get("theme")?.value;
  const themePref: ThemePref = themeCookie === "light" || themeCookie === "dark" ? themeCookie : "system";
  const member = !!user.orgId;
  const specialist = user.role === "SPECIALIST";
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
  // "+ Kirim" tugmasi: mijoz to'lovi, ijarachi to'lovi yoki boshqa kirimdan birortasini kiritish huquqi bo'lsa.
  const canIncome = member && (canEdit(user, "settlements") || canEdit(user, "lessors") || (showCash && canEdit(user, "cash")));
  const withCount =(label: string, n: number) => (n > 0 ? `${label} (${n})` : label);
  const items = !member ? [
    { href: "/admin/orgs", label: t("nav.orgs") },
    { href: "/admin/applications", label: withCount(t("app.title"), pendingApps) },
    { href: "/admin/payments", label: withCount(t("inv.title"), reviewInvoices) },
    { href: "/admin/site", label: t("site.admin") },
    { href: "/admin/settings", label: t("set.title") },
  ] : ([
    { href: "/", label: t("nav.home") },
    { href: "/trips", label: t("nav.trips"), section: "trips" },
    { href: "/clients", label: t("nav.clients"), section: "clients" },
    { href: "/settlements", label: t("nav.settlements"), section: "settlements" },
    { href: "/lessors", label: t("nav.lessors"), section: "lessors" },
    ...(showCash ? [{ href: "/cash", label: t("nav.cash"), section: "cash" as const }] : []),
    { href: "/vehicles", label: t("nav.vehicles"), section: "vehicles" },
    { href: "/drivers", label: t("nav.drivers"), section: "drivers" },
    // TIR va dazvol — bitta bo'lim (17.11.2026), ichida ikki menyu. Mutaxassisga faqat bittasi berilgan bo'lishi mumkin.
    canView(user, "tir") || !specialist
      ? { href: "/tir", label: t("nav.tir"), section: "tir", match: ["/dazvol"] }
      : { href: "/dazvol", label: t("nav.tir"), section: "dazvol", match: ["/tir"] },
    { href: "/org-docs", label: t("nav.orgDocs"), section: "orgdocs", specialistOnly: true },
    { href: "/reports", label: t("nav.reports"), section: "reports" },
  ] as { href: string; label: string; section?: Section; specialistOnly?: boolean; match?: string[] }[])
    // Mutaxassis menyuda faqat ruxsat berilgan bo'limlarni ko'radi (bosh sahifa ham — birinchi bo'lim).
    .filter((it) => (specialist ? !!it.section && canView(user, it.section) : !it.specialistOnly))
    .map(({ href, label, match }) => ({ href, label, match }));
  const headerLinks = !member ? [accountLink] : specialist ? [
    { href: "/activity", label: t("act.title"), icon: "history" as const },
    accountLink,
  ] : [
    { href: "/alerts", label: t("nav.alerts"), icon: "bell" as const, badge: alertCount },
    { href: "/activity", label: t("act.title"), icon: "history" as const },
    { href: "/settings", label: t("settings.title"), icon: "gear" as const, match: ["/org-docs", "/team", "/currencies"] },
    accountLink,
  ];
  const orgLabel = user.orgName ?? t("admin.panel");
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 print:hidden flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-paper px-4 py-2.5 shadow-sm">
        <Link href={homeFor(user)} aria-label={t("appName")}><Logo name={t("appName")} /></Link>
        {user.memberships > 1 ? (
          <Link href="/select-org" title={t("org.switch")} className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-sm hover:border-accent">
            {orgLabel} <span aria-hidden className="text-accent">⇄</span>
          </Link>
        ) : (
          <span className="text-sm text-muted">{orgLabel}</span>
        )}
        {member && (
          <div className="order-last flex w-full items-center gap-2 sm:order-none sm:w-auto sm:flex-1 sm:justify-center print:hidden">
            <form action="/search" role="search" className="flex min-w-0 flex-1 items-center sm:max-w-sm">
              <input name="q" type="search" placeholder={t("search.placeholder")} aria-label={t("search.title")} className="input min-h-9 rounded-r-none py-1 text-sm" />
              <button className="btn-ghost min-h-9 rounded-l-none border-l-0 px-3 py-1" aria-label={t("common.search")}>🔍</button>
            </form>
            {canIncome && <QuickIncome d={pickDict(await getDict(), INCOME_KEYS)} />}
          </div>
        )}
        {!member && <span className="flex-1" />}
        <HeaderLinks items={headerLinks} />
        <ThemeToggle initial={themePref} labels={{ system: t("theme.system"), light: t("theme.light"), dark: t("theme.dark") }} />
        <LangSwitch />
        <span className="text-sm text-muted">{roleTitle(t, user)} · {user.fullName}</span>
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
