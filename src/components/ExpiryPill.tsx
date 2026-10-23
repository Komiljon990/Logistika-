import type { T } from "@/i18n";
import { daysLeft, expiryLevel } from "@/lib/docs";

const STYLE = {
  expired: "bg-bad-soft text-bad",
  d7: "bg-bad-soft text-bad",
  d15: "bg-warn-soft text-warn",
  d30: "bg-warn-soft text-warn",
  ok: "bg-accent-soft text-accent",
} as const;

export function ExpiryPill({ expiresAt, t }: { expiresAt: Date | null; t: T }) {
  const days = daysLeft(expiresAt);
  const level = expiryLevel(days);
  if (level === "none" || days === null) return null;
  const text = days < 0 ? t("doc.expired") : days === 0 ? t("doc.expiresToday") : `${days} ${t("doc.daysLeft")}`;
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${STYLE[level]}`}>{text}</span>;
}
