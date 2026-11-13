import "server-only";
import type { DocType } from "@prisma/client";
import { db } from "./db";
import { orgScope, type ScopeUser } from "./scope";
import { ALERT_DAYS, type AlertItem } from "./alerts-core";

export { groupAlerts, ALERT_DAYS, type AlertItem, type AlertGroup } from "./alerts-core";

/** Arxivlanmagan transport/haydovchi hujjatlari va tashkilot hujjatlari (egasi bo'sh). */
function docWhere(user: ScopeUser, until: Date) {
  return {
    ...orgScope(user),
    status: "ACTIVE" as const,
    expiresAt: { not: null, lte: until },
    OR: [
      { vehicle: { status: "ACTIVE" as const } },
      { driver: { status: "ACTIVE" as const } },
      { vehicleId: null, driverId: null },
    ],
  };
}

function leaseWhere(user: ScopeUser, until: Date) {
  return { ...orgScope(user), status: "ACTIVE" as const, ownership: "LEASED" as const, leaseEnd: { not: null, lte: until } };
}

function until(today: Date) {
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + ALERT_DAYS));
}

/** Menyudagi son: muddati o'tgan va 30 kun ichida tugaydigan hujjatlar va ijaralar. */
export async function countAlerts(user: ScopeUser, today: Date): Promise<number> {
  const u = until(today);
  const [docs, leases] = await Promise.all([
    db.document.count({ where: docWhere(user, u) }),
    db.vehicle.count({ where: leaseWhere(user, u) }),
  ]);
  return docs + leases;
}

export async function loadAlerts(user: ScopeUser, today: Date): Promise<AlertItem[]> {
  const u = until(today);
  const [docs, leases] = await Promise.all([
    db.document.findMany({
      where: docWhere(user, u),
      orderBy: { expiresAt: "asc" },
      include: {
        org: { select: { name: true } },
        vehicle: { select: { id: true, plate: true } },
        driver: { select: { id: true, fullName: true } },
      },
    }),
    db.vehicle.findMany({
      where: leaseWhere(user, u),
      orderBy: { leaseEnd: "asc" },
      select: { id: true, plate: true, leaseEnd: true, leaseOwner: true, org: { select: { name: true } } },
    }),
  ]);
  const items: AlertItem[] = docs.map((x) => ({
    key: `doc:${x.id}`,
    kind: x.vehicle ? "vehicle" : x.driver ? "driver" : "org",
    href: x.vehicle ? `/vehicles/${x.vehicle.id}` : x.driver ? `/drivers/${x.driver.id}` : `/org-docs?org=${x.orgId}`,
    owner: x.vehicle?.plate ?? x.driver?.fullName ?? x.org.name,
    orgName: x.org.name,
    docType: x.type as DocType,
    title: x.title,
    number: x.number,
    expiresAt: x.expiresAt!,
  }));
  for (const v of leases) {
    items.push({
      key: `lease:${v.id}`,
      kind: "lease",
      href: `/vehicles/${v.id}`,
      owner: v.plate,
      orgName: v.org.name,
      docType: null,
      number: v.leaseOwner,
      expiresAt: v.leaseEnd!,
    });
  }
  return items.sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());
}
