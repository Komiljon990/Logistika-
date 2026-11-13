"use client";

import { useState } from "react";

export type ThemePref = "system" | "light" | "dark";
const ORDER: ThemePref[] = ["system", "light", "dark"];

function apply(pref: ThemePref) {
  const el = document.documentElement;
  if (pref === "system") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", pref);
  document.cookie = `theme=${pref}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

/** Yorug' / qorong'i / tizim bo'yicha. Tanlov cookie'da saqlanadi — sahifa miltillamasdan ochiladi. */
export function ThemeToggle({ initial, labels }: { initial: ThemePref; labels: Record<ThemePref, string> }) {
  const [pref, setPref] = useState<ThemePref>(initial);
  const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
  return (
    <button
      type="button"
      onClick={() => { apply(next); setPref(next); }}
      aria-label={`${labels[pref]} → ${labels[next]}`}
      title={labels[pref]}
      className="grid size-10 place-items-center rounded-lg border border-line text-ink hover:bg-accent-soft"
    >
      {pref === "light" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : pref === "dark" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M8 20h8M12 16v4" />
        </svg>
      )}
    </button>
  );
}
