/**
 * "Bugungi holat" (18.11.2026; 19.11.2026 dan bosh sahifa va Telegram bot uchun umumiy): faol reyslar, mijozlar qarzi,
 * ijarachilar qarzi, haydovchilarga qarzimiz. Foydalanuvchi ko'ra olmaydigan bo'lim — null.
 * "server-only" import qilinmaydi: bot instrumentation.ts dan ishga tushadi.
 */
import { db } from "./db";
import { canView, type AccessUser } from "./access";
import { orgScope, type ScopeUser } from "./scope";
import { balancesByClient, loadLedger } from "./settlement";

export type Money = Record<string, number>;
export type TodaySummary = {
  activeTrips: number | null;
  loadedTrips: number;
  clientDebt: Money | null;
  lessorDebt: Money | null;
  staffDebt: Money | null;
};

export async function todaySummary(user: ScopeUser & AccessUser): Promise<TodaySummary> {
  const scope = orgScope(user);
  const trips = canView(user, "trips");
  const [activeTrips, loadedTrips, ledgerSums, clientDebt] = await Promise.all([
    trips ? db.trip.count({ where: { ...scope, status: "ACTIVE" } }) : Promise.resolve(null),
    trips ? db.trip.count({ where: { ...scope, status: "ACTIVE", events: { none: { type: "UNLOADED" } } } }) : Promise.resolve(0),
    canView(user, "lessors") || canView(user, "settlements")
      ? db.driverEntry.groupBy({ by: ["side", "kind", "currency"], where: { ...scope, status: "ACTIVE" }, _sum: { amount: true } })
      : Promise.resolve([]),
    canView(user, "settlements")
      ? loadLedger(scope).then(({ shipments, payments }) => {
          const m: Money = {};
          for (const b of balancesByClient(shipments, payments).values()) for (const [cur, x] of Object.entries(b)) if (x.debt > 0) m[cur] = (m[cur] ?? 0) + x.debt;
          return m;
        })
      : Promise.resolve(null),
  ]);
  const sideDebt = (side: "LESSOR" | "STAFF"): Money => {
    const m: Money = {};
    for (const r of ledgerSums.filter((x) => x.side === side)) m[r.currency] = Math.round(((m[r.currency] ?? 0) + (r.kind === "CHARGE" ? 1 : -1) * Number(r._sum.amount ?? 0)) * 100) / 100;
    return Object.fromEntries(Object.entries(m).filter(([, v]) => v > 0.004));
  };
  return {
    activeTrips,
    loadedTrips,
    clientDebt,
    lessorDebt: canView(user, "lessors") ? sideDebt("LESSOR") : null,
    staffDebt: canView(user, "settlements") ? sideDebt("STAFF") : null,
  };
}
