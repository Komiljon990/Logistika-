// "server-only" import qilinmaydi (19.11.2026): Telegram bot (instrumentation.ts) xodimlarga shu ma'lumotlarni ko'rsatadi.
import type { CashHolder, PaymentMethod, PaymentTerms, ChargeKind, DemurrageFault, Prisma } from "@prisma/client";
import { db } from "./db";
import { accountLabel } from "./cash-core";
import { billableAmounts, clientBalance, payStatus, round2, shipmentTotals, type CurrencyBalance, type PayStatus } from "./settlement-core";

export type LedgerShipment = {
  id: string; clientId: string; tripId: string; tripNumber: number; routeFrom: string; routeTo: string; plate: string;
  loadDate: Date; currency: string; terms: PaymentTerms; price: number;
  charges: { id: string; kind: ChargeKind; description: string | null; days: number | null; dailyAmount: number | null; fault: DemurrageFault | null; amount: number; date: Date }[];
  charged: number; paid: number; remaining: number; status: PayStatus; order: number;
};

export type LedgerPayment = {
  id: string; orgId: string; clientId: string; date: Date; amount: number; currency: string; method: PaymentMethod;
  receivedBy: CashHolder | null; driverName: string | null; handedOverAt: Date | null; note: string | null; active: boolean;
  accountId: string | null; accountLabel: string | null;
  allocations: { shipmentId: string; tripNumber: number; applied: number; consumed: number; rate: number; rateManual: boolean; currency: string }[];
  advance: number;
};

/**
 * Hisob-kitob daftari: faol yuk qismlari (bekor qilingan tashishlarsiz) va to'lovlar.
 * `where` — markaziy tashkilot filtri (orgScope) va ixtiyoriy mijoz.
 */
export async function loadLedger(where: { orgId?: string; clientId?: string }) {
  // "Faqat ro'yxat" tashishlari hisob-kitobga kirmaydi (17.11.2026).
  const shipWhere: Prisma.ShipmentWhereInput = { ...where, status: "ACTIVE", trip: { status: { not: "CANCELLED" }, listOnly: false } };
  const [ships, pays] = await Promise.all([
    db.shipment.findMany({
      where: shipWhere,
      orderBy: [{ trip: { loadDate: "asc" } }, { createdAt: "asc" }],
      include: {
        trip: { select: { id: true, number: true, routeFrom: true, routeTo: true, loadDate: true, tractor: { select: { plate: true } } } },
        charges: { where: { status: "ACTIVE" }, orderBy: { date: "asc" } },
        allocations: { where: { payment: { status: "ACTIVE" } }, select: { applied: true } },
      },
    }),
    db.payment.findMany({
      where,
      orderBy: { date: "desc" },
      include: {
        driver: { select: { fullName: true } },
        account: true,
        allocations: { include: { shipment: { select: { currency: true, trip: { select: { number: true } } } } } },
      },
    }),
  ]);

  const shipments: LedgerShipment[] = ships.map((s, i) => {
    const charges = s.charges.map((c) => ({
      id: c.id, kind: c.kind, description: c.description, days: c.days, fault: c.fault,
      dailyAmount: c.dailyAmount == null ? null : Number(c.dailyAmount), amount: Number(c.amount), date: c.date,
    }));
    const tot = shipmentTotals(Number(s.price), billableAmounts(charges), s.allocations.map((a) => Number(a.applied)));
    return {
      id: s.id, clientId: s.clientId, tripId: s.trip.id, tripNumber: s.trip.number, routeFrom: s.trip.routeFrom, routeTo: s.trip.routeTo,
      plate: s.trip.tractor.plate, loadDate: s.trip.loadDate, currency: s.currency, terms: s.terms, price: Number(s.price),
      charges, ...tot, status: payStatus(tot.charged, tot.paid), order: i,
    };
  });

  const payments: LedgerPayment[] = pays.map((p) => {
    const allocations = p.allocations.map((a) => ({
      shipmentId: a.shipmentId, tripNumber: a.shipment.trip.number, applied: Number(a.applied), consumed: Number(a.consumed),
      rate: Number(a.rate), rateManual: a.rateManual, currency: a.shipment.currency,
    }));
    const used = allocations.reduce((s, a) => s + a.consumed, 0);
    return {
      id: p.id, orgId: p.orgId, clientId: p.clientId, date: p.date, amount: Number(p.amount), currency: p.currency, method: p.method,
      receivedBy: p.receivedBy, driverName: p.driver?.fullName ?? null, handedOverAt: p.handedOverAt, note: p.note,
      active: p.status === "ACTIVE", accountId: p.accountId, accountLabel: p.account ? accountLabel(p.account) : null, allocations, advance: p.status === "ACTIVE" ? round2(Number(p.amount) - used) : 0,
    };
  });
  return { shipments, payments };
}

/** Har mijoz bo'yicha valyutalar balansi. */
export function balancesByClient(shipments: LedgerShipment[], payments: LedgerPayment[]): Map<string, Record<string, CurrencyBalance>> {
  const ids = new Set([...shipments.map((s) => s.clientId), ...payments.map((p) => p.clientId)]);
  const out = new Map<string, Record<string, CurrencyBalance>>();
  for (const id of ids) {
    out.set(id, clientBalance(
      shipments.filter((s) => s.clientId === id),
      payments.filter((p) => p.clientId === id && p.active),
    ));
  }
  return out;
}
