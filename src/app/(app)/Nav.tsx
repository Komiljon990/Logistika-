"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href?: string; label: string; soon?: string; badge?: number; match?: string[] };

export function Nav({ items }: { items: Item[] }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto text-base font-medium md:grid md:content-start">
      {items.map((it) =>
        it.href ? (
          <Link
            key={it.label}
            href={it.href}
            className={`whitespace-nowrap rounded-lg px-3.5 py-2.5 ${
              (it.href === "/" ? path === "/" : path.startsWith(it.href) || !!it.match?.some((m) => path.startsWith(m)))
                ? "bg-accent-soft font-semibold text-accent"
                : "text-ink hover:bg-ground"
            }`}
          >
            {it.label}
            {!!it.badge && (
              <span className="ml-2 rounded-full bg-bad px-2 py-0.5 text-xs font-semibold text-on-accent tabular-nums">{it.badge}</span>
            )}
          </Link>
        ) : (
          <span key={it.label} title={it.soon} className="flex cursor-default items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2.5 text-muted">
            {it.label}
          </span>
        ),
      )}
    </nav>
  );
}
