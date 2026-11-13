import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import type { DoneEvents } from "./trips-core";

type Tx = Prisma.TransactionClient | typeof db;

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
