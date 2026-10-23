import type { Status } from "@prisma/client";
import type { T } from "@/i18n";

const STYLE: Record<Status, string> = {
  ACTIVE: "bg-accent-soft text-accent",
  BLOCKED: "bg-bad-soft text-bad",
  ARCHIVED: "bg-ground text-muted",
};

export function StatusPill({ status, t }: { status: Status; t: T }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs ${STYLE[status]}`}>{t(`status.${status}`)}</span>;
}
