/**
 * ReysPro logotipi: boshlanish nuqtasidan manzilga boradigan marshrut va yo'nalish o'qi.
 * Ranglar mavzudan olinadi (yorug' va qorong'i rejimda o'zi moslashadi).
 */
export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--color-accent)" />
      <path d="M8 23.5c0-5 4-6.5 8-6.5s8-1.5 8-6.5" fill="none" stroke="var(--color-on-accent)" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="8" cy="23.5" r="2.6" fill="var(--color-on-accent)" />
      <path d="M19.6 8.2 24.4 8l-.2 4.8" fill="none" stroke="var(--color-on-accent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      <span className="text-lg font-bold tracking-tight text-ink">
        {name.replace(/Pro$/, "")}<span className="text-accent">Pro</span>
      </span>
    </span>
  );
}
