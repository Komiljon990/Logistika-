import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import type { DoneEvents } from "./trips-core";

type Tx = Prisma.TransactionClient | typeof db;

/** Bir tashkilot ichidagi yozuvlar (tashish, yuk, to'lov taqsimoti) ketma-ket bajariladi. */
export async function lockOrg(tx: Prisma.TransactionClient, orgId: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${orgId}))::text`;
}

/** Yuki bor transportlar (tyagach va prisept): faol tashish, yuk hali tushirilmagan. */
export async function loadedVehicleIds(orgId: string, tx: Tx = db): Promise<Set<string>> {
  const trips = await tx.trip.findMany({
    where: { orgId, status: "ACTIVE", events: { none: { type: "UNLOADED" } } },
    select: { tractorId: true, trailerId: true },
  });
  return new Set(trips.flatMap((t) => [t.tractorId, t.trailerId].filter((x): x is string => !!x)));
}

export async function doneEvents(tx: Tx, tripId: string): Promise<DoneEvents> {
  const events = await tx.tripEvent.findMany({ where: { tripId }, select: { type: true, at: true } });
  return Object.fromEntries(events.map((e) => [e.type, e.at]));
}

/**
 * Avval kiritilgan joy nomlari (qayerdan / qayerga) — tez-tez ishlatilgani birinchi. Formada ro'yxat bo'lib chiqadi,
 * 1-2 harf yozilishi bilan brauzer filtrlab ko'rsatadi.
 */
export async function routePlaces(orgId: string): Promise<string[]> {
  const [from, to] = await Promise.all([
    db.trip.groupBy({ by: ["routeFrom"], where: { orgId }, _count: { _all: true } }),
    db.trip.groupBy({ by: ["routeTo"], where: { orgId }, _count: { _all: true } }),
  ]);
  const freq = new Map<string, { name: string; n: number }>();
  const put = (name: string, n: number) => {
    const key = name.trim().toLowerCase();
    if (!key) return;
    const cur = freq.get(key);
    freq.set(key, { name: cur?.name ?? name.trim(), n: (cur?.n ?? 0) + n });
  };
  for (const r of from) put(r.routeFrom, r._count._all);
  for (const r of to) put(r.routeTo, r._count._all);
  return [...freq.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).slice(0, 500).map((x) => x.name);
}