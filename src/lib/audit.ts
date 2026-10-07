import type { Prisma } from "@prisma/client";
import { db } from "./db";

export async function audit(entry: {
  actorId: string | null;
  orgId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  details?: Prisma.InputJsonValue;
}) {
  await db.auditLog.create({ data: { ...entry, orgId: entry.orgId ?? null } });
}
