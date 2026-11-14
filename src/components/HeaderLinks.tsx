"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: "bell" | "history" | "gear"; badge?: number; match?: string[] };

const ICONS = {
  bell: <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l4 2" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
};

/** Yuqori paneldagi belgili tugmalar: ogohlantirishlar (soni bilan), oxirgi amallar, sozlamalar. */
export function HeaderLinks({ items }: { items: Item[] }) {
  const path = usePathname();
  return (
    <div className="flex items-center gap-1">
      {items.map((it) => {
        const active = [it.href, ...(it.match ?? [])].some((h) => path === h || path.startsWith(`${h}/`));
        return (
          <Link
            key={it.href}
            href={it.href}
            title={it.label}
            aria-label={it.badge ? `${it.label}: ${it.badge}` : it.label}
            aria-current={active ? "page" : undefined}
            className={`relative grid size-10 place-items-center rounded-lg ${active ? "bg-accent-soft text-accent" : "text-ink hover:bg-ground"}`}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {ICONS[it.icon]}
            </svg>
            {!!it.badge && (
              <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-bad px-1 text-center text-[11px] font-bold leading-5 text-on-accent tabular-nums">
                {it.badge > 99 ? "99+" : it.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
