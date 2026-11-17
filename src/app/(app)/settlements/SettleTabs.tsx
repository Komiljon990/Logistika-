import Link from "next/link";
import type { T } from "@/i18n";

/** Hisob-kitob bo'limi ikki menyu: mijozlar bilan va xodim haydovchilar bilan. */
export function SettleTabs({ t, active }: { t: T; active: "clients" | "drivers" }) {
  const tabs = [
    { key: "clients", href: "/settlements", label: t("settle.tab.clients") },
    { key: "drivers", href: "/settlements/drivers", label: t("settle.tab.drivers") },
  ] as const;
  return (
    <nav className="card flex gap-1 overflow-x-auto p-1.5 text-sm font-medium print:hidden">
      {tabs.map((x) => (
        <Link key={x.key} href={x.href} aria-current={active === x.key ? "page" : undefined}
          className={`whitespace-nowrap rounded-lg px-4 py-2 ${active === x.key ? "bg-accent-soft font-semibold text-accent" : "text-ink hover:bg-ground"}`}>
          {x.label}
        </Link>
      ))}
    </nav>
  );
}
