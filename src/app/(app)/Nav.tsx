"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href?: string; label: string; soon?: string };

export function Nav({ items }: { items: Item[] }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto text-sm md:grid md:content-start">
      {items.map((it) =>
        it.href ? (
          <Link
            key={it.label}
            href={it.href}
            className={`whitespace-nowrap rounded-md px-3 py-2 ${
              (it.href === "/" ? path === "/" : path.startsWith(it.href))
                ? "bg-accent-soft font-semibold text-accent"
                : "hover:bg-paper"
            }`}
          >
            {it.label}
          </Link>
        ) : (
          <span key={it.label} title={it.soon} className="cursor-default whitespace-nowrap rounded-md px-3 py-2 text-muted/60">
            {it.label}
          </span>
        ),
      )}
    </nav>
  );
}
