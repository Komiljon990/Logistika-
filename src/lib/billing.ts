import "server-only";
import type { BillingPeriod, Invoice, InvoiceKind } from "@prisma/client";
import { db } from "./db";
import { isPlan, planLimit, type PlanId } from "./billing-core";

/** Bugungi Toshkent sanasi (UTC yarim tun) — obuna davrlari sanalar bilan hisoblanadi. */
export function todayDate(now = new Date()): Date {
  const t = new Date(now.getTime() + 5 * 3_600_000);
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
}

export function activeTractors(orgId: string) {
  return db.vehicle.count({ where: { orgId, type: "TRACTOR", status: "ACTIVE" } });
}

/**
 * Yana `add` ta faol tyagach tarifga sig'adimi. Tarif belgilanmagan (Super Admin qo'lda yaratgan) tashkilot cheklanmaydi.
 * Demo tashkilot ham cheklanmaydi.
 */
export async function tractorCapacity(orgId: string, add = 1): Promise<{ ok: true } | { ok: false; limit: number }> {
  const org = await db.organization.findUniqueOrThrow({ where: { id: orgId }, select: { plan: true, isDemo: true } });
  const limit = org.isDemo ? null : planLimit(org.plan);
  if (limit === null) return { ok: true };
  return (await activeTractors(orgId)) + add <= limit ? { ok: true } : { ok: false, limit };
}

export async function createInvoice(opts: {
  orgId: string; kind: InvoiceKind; plan: PlanId; period: BillingPeriod; start: Date; end: Date;
  q: { baseAmount: number; discountPercent: number; amount: number }; actorId: string | null;
}): Promise<Invoice> {
  return db.invoice.create({
    data: {
      orgId: opts.orgId, kind: opts.kind, plan: opts.plan, period: opts.period, periodStart: opts.start, periodEnd: opts.end,
      baseAmount: opts.q.baseAmount, discountPercent: opts.q.discountPercent, amount: opts.q.amount, createdById: opts.actorId,
    },
  });
}

/**
 * To'lov tasdiqlanganda obunaga ta'siri: tarifni oshirish — yangi tarif darhol; uzaytirish — yangi davr.
 * Birinchi obuna (NEW) ariza tasdiqlangandayoq qo'llangan.
 */
export async function applyPaid(inv: Invoice) {
  if (!isPlan(inv.plan)) return;
  if (inv.kind === "UPGRADE") {
    await db.organization.update({ where: { id: inv.orgId }, data: { plan: inv.plan } });
  } else if (inv.kind === "RENEWAL") {
    const org = await db.organization.findUniqueOrThrow({ where: { id: inv.orgId } });
    if (org.subEnd && inv.periodEnd <= org.subEnd) return;
    // Uzluksiz davom etsa, obuna boshlanishi saqlanadi (tarifni oshirishda qolgan davr to'g'ri hisoblanadi).
    const continuous = !!org.subEnd && !!org.subStart && inv.periodStart.getTime() <= org.subEnd.getTime() + 86_400_000;
    await db.organization.update({
      where: { id: inv.orgId },
      data: { plan: inv.plan, period: inv.period, subStart: continuous ? org.subStart : inv.periodStart, subEnd: inv.periodEnd },
    });
  }
}

/** Ochiq (to'lanmagan yoki tekshiruvdagi) hisoblar — Super Admin menyusidagi belgi uchun. */
export function reviewCount() {
  return db.invoice.count({ where: { status: "REVIEW" } });
}
