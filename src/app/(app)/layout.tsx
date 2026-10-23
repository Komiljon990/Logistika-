import Link from "next/link";
import { getT } from "@/i18n";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/roles";
import { logout } from "@/app/actions";
import { LangSwitch } from "@/components/LangSwitch";
import { Nav } from "./Nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const t = await getT();
  const items = [
    { href: "/", label: t("nav.home") },
    ...(["nav.trips", "nav.vehicles", "nav.drivers", "nav.tir", "nav.reports"] as const).map((k) => ({
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
  return (
    <div className="min-h-dvh">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-paper px-4 py-3">
        <Link href="/" className="font-bold text-accent">{t("appName")}</Link>
        <span className="text-sm text-muted">{user.orgName ?? t("home.allOrgs")}</span>
        <span className="flex-1" />
        <LangSwitch />
        <span className="text-sm text-muted">{t(`role.${user.role}`)} · {user.fullName}</span>
        <form action={logout}><button className="text-sm text-accent hover:underline">{t("logout")}</button></form>
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[200px_minmax(0,1fr)]">
        <Nav items={items} />
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
