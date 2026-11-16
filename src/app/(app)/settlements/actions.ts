"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser, requireSection } from "@/lib/session";
import { orgForWrite, ForbiddenError } from "@/lib/scope";
import { parseDate } from "@/lib/dates";
import { addDays, parseAmount, parseDay, type RateMap } from "@/lib/currency-core";
import { activeCurrencies } from "@/lib/org-currency";
import { paymentAccounts } from "@/lib/cash";
import { accountKindFor, type AccountKind } from "@/lib/cash-core";
import { ensureRates, rateMap } from "@/lib/rates";
import { tashkentToday } from "@/lib/docs";
import { lockOrg } from "@/lib/trips";
import { fail, optStr, str, type FormState } from "@/lib/form";
import { checkAllocations, demurrage, round2, shipmentTotals, type AllocationInput, type Method, type OpenShipment } from "@/lib/settlement-core";
import type { Dict } from "@/i18n";

/** To'lov, qo'shimcha xarajat va prostoyni menejer kiritadi (texnik shart 2-bo'lim). */
async function editor() {
  const user = await requireSection("settlements", "EDIT");
  return { user, orgId: orgForWrite(user) };
}

type Tx = Prisma.TransactionClient;

class FormError extends Error {
  constructor(public key: keyof Dict) { super(key); }
}

function revalidate(clientId: string, tripId?: string) {
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/settlements");
  if (tripId) revalidatePath(`/trips/${tripId}`);
}

/** Markaziy bank kurslari (to'lov formasida sana o'zgarganda). Ochiq ma'lumot, faqat tizimga kirganlar uchun. */
export async function ratesForDay(day: string): Promise<RateMap> {
  await requireUser();
  const today = tashkentToday().toISOString().slice(0, 10);
  const d = parseDay(day);
  // Oxirgi 2 yil bilan cheklanadi: minglab eski sanalar so'rab tashqi so'rovlar uyushtirib bo'lmasin.
  if (!d || d > today || d < addDays(today, -730)) return {};
  await ensureRates([d], today);
  return rateMap(d);
}

/**
 * Tushum qaysi hisobga tushadi. Hisob turi to'lov turiga, valyutasi to'lov valyutasiga mos bo'lishi shart.
 * Kassa yoqilgan va hisob ochilgan tashkilotda hisob majburiy; aks holda ixtiyoriy (bo'sh — "ko'rsatilmagan").
 */
async function pickAccount(orgId: string, kind: AccountKind | null, currency: string, raw: string): Promise<{ id: string | null } | { error: keyof Dict }> {
  if (!kind) return { id: null };
  const { options, required } = await paymentAccounts(orgId);
  if (!raw) return required ? { error: "pay.error.account" } : { id: null };
  const a = options.find((o) => o.id === raw);
  if (!a || a.kind !== kind || a.currency !== currency) return { error: "pay.error.accountMismatch" };
  return { id: a.id };
}

// ---------- Qo'shimcha xarajat va prostoy ----------

export async function addCharge(shipmentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await editor();
  const s = await db.shipment.findFirst({ where: { id: shipmentId, orgId, status: "ACTIVE", trip: { status: { not: "CANCELLED" }, listOnly: false } } });
  if (!s) throw new ForbiddenError();
  const kind = str(formData, "kind");
  const date = parseDate(formData.get("date"));
  if (!date || (kind !== "EXTRA" && kind !== "DEMURRAGE")) return fail("common.required", formData);
  let amount: number | null;
  let days: number | null = null;
  let daily: number | null = null;
  if (kind === "DEMURRAGE") {
    days = Number(str(formData, "days"));
    daily = parseAmount(str(formData, "dailyAmount"));
    if (!Number.isInteger(days) || days < 1 || days > 365 || daily === null || daily <= 0) return fail("pay.error.demurrage", formData);
    amount = demurrage(days, daily);
  } else {
    amount = parseAmount(str(formData, "amount"));
  }
  if (amount === null || amount <= 0 || amount > 1e12) return fail("pay.error.amount", formData);
  const c = await db.shipmentCharge.create({
    data: { orgId, shipmentId, kind, days, dailyAmount: daily, amount, date, description: optStr(formData, "description", 200), createdById: user.id },
  });
  await audit({ actorId: user.id, orgId, action: "charge.create", entity: "ShipmentCharge", entityId: c.id, details: { shipmentId, kind, amount, days, daily, currency: s.currency } });
  revalidate(s.clientId, s.tripId);
  return { ok: true };
}

export async function cancelCharge(chargeId: string): Promise<FormState> {
  const { user, orgId } = await editor();
  const c = await db.shipmentCharge.findFirst({ where: { id: chargeId, orgId, status: "ACTIVE" }, include: { shipment: true } });
  if (!c) throw new ForbiddenError();
  await db.shipmentCharge.update({ where: { id: chargeId }, data: { status: "ARCHIVED" } });
  await audit({ actorId: user.id, orgId, action: "charge.cancel", entity: "ShipmentCharge", entityId: chargeId });
  revalidate(c.shipment.clientId, c.shipment.tripId);
  return { ok: true };
}

// ---------- To'lovlar ----------

/** Brauzerdan kelgan taqsimot: [{ shipmentId, applied, rate, manual }]. */
function parseAlloc(raw: string): (AllocationInput & { manual: boolean })[] | null {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length > 200) return null;
    return arr.map((x) => ({
      shipmentId: String(x.shipmentId),
      applied: round2(Number(x.applied)),
      rate: Number(x.rate),
      manual: !!x.manual,
    }));
  } catch {
    return null;
  }
}

/** Mijozning ochiq (qoldig'i bor) yuk qismlari — tranzaksiya ichida, qulf ostida hisoblanadi. */
async function openShipments(tx: Tx, orgId: string, clientId: string): Promise<Map<string, OpenShipment & { tripId: string }>> {
  const ships = await tx.shipment.findMany({
    where: { orgId, clientId, status: "ACTIVE", trip: { status: { not: "CANCELLED" }, listOnly: false } },
    include: {
      charges: { where: { status: "ACTIVE" }, select: { amount: true } },
      allocations: { where: { payment: { status: "ACTIVE" } }, select: { applied: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return new Map(ships.map((s, i) => {
    const tot = shipmentTotals(Number(s.price), s.charges.map((c) => Number(c.amount)), s.allocations.map((a) => Number(a.applied)));
    return [s.id, { id: s.id, currency: s.currency, remaining: tot.remaining, terms: s.terms, order: i, tripId: s.tripId }];
  }));
}

export async function createPayment(clientId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await editor();
  const client = await db.client.findFirst({ where: { id: clientId, orgId } });
  if (!client) throw new ForbiddenError();
  const date = parseDate(formData.get("date"));
  const amount = parseAmount(str(formData, "amount"));
  const currency = str(formData, "currency");
  const method = str(formData, "method") as Method;
  const today = tashkentToday().toISOString().slice(0, 10);
  if (!date || date.toISOString().slice(0, 10) > today) return fail("pay.error.date", formData);
  if (amount === null || amount <= 0 || amount > 1e13) return fail("pay.error.amount", formData);
  if (!["BANK", "CASH", "CARD"].includes(method)) return fail("common.required", formData);
  if (!(await activeCurrencies(orgId)).includes(currency)) return fail("trip.error.currency", formData);
  const receivedBy = method === "CASH" ? (str(formData, "receivedBy") === "DRIVER" ? "DRIVER" : "OFFICE") : null;
  let driverId: string | null = null;
  if (receivedBy === "DRIVER") {
    const d = await db.driver.findFirst({ where: { id: str(formData, "driverId"), orgId } });
    if (!d) return fail("pay.error.driver", formData);
    driverId = d.id;
  }
  const alloc = parseAlloc(str(formData, "alloc"));
  if (!alloc) return fail("common.required", formData);
  const acc = await pickAccount(orgId, accountKindFor(method, receivedBy), currency, str(formData, "accountId"));
  if ("error" in acc) return fail(acc.error, formData);
  const accountId = acc.id;

  let paymentId: string;
  try {
    paymentId = await db.$transaction(async (tx) => {
      await lockOrg(tx, orgId);
      const open = await openShipments(tx, orgId, clientId);
      const check = checkAllocations(amount, method, alloc, open);
      if (!check.ok) throw new FormError(check.error);
      const p = await tx.payment.create({
        data: { orgId, clientId, date, amount, currency, method, receivedBy, driverId, accountId, note: optStr(formData, "note", 300), createdById: user.id },
      });
      if (alloc.length) {
        await tx.paymentAllocation.createMany({
          data: alloc.map((a, i) => ({ paymentId: p.id, shipmentId: a.shipmentId, applied: a.applied, consumed: check.consumed[i], rate: a.rate, rateManual: a.manual })),
        });
      }
      return p.id;
    });
  } catch (e) {
    if (e instanceof FormError) return fail(e.key, formData);
    throw e;
  }
  await audit({
    actorId: user.id, orgId, action: "payment.create", entity: "Payment", entityId: paymentId,
    details: { clientId, amount, currency, method, receivedBy, driverId, accountId, allocations: alloc },
  });
  revalidate(clientId);
  for (const a of alloc) {
    const s = await db.shipment.findUnique({ where: { id: a.shipmentId }, select: { tripId: true } });
    if (s) revalidatePath(`/trips/${s.tripId}`);
  }
  return { ok: true };
}

/** Avansni (to'lovning taqsimlanmagan qismini) keyinchalik qarzga yopish. */
export async function allocateAdvance(paymentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await editor();
  const alloc = parseAlloc(str(formData, "alloc"));
  if (!alloc || !alloc.length) return fail("pay.error.pick", formData);
  let clientId: string;
  try {
    clientId = await db.$transaction(async (tx) => {
      await lockOrg(tx, orgId);
      const p = await tx.payment.findFirst({ where: { id: paymentId, orgId, status: "ACTIVE" }, include: { allocations: { select: { consumed: true } } } });
      if (!p) throw new ForbiddenError();
      const advance = round2(Number(p.amount) - p.allocations.reduce((s, a) => s + Number(a.consumed), 0));
      const open = await openShipments(tx, orgId, p.clientId);
      const check = checkAllocations(advance, p.method, alloc, open);
      if (!check.ok) throw new FormError(check.error);
      await tx.paymentAllocation.createMany({
        data: alloc.map((a, i) => ({ paymentId: p.id, shipmentId: a.shipmentId, applied: a.applied, consumed: check.consumed[i], rate: a.rate, rateManual: a.manual })),
      });
      return p.clientId;
    });
  } catch (e) {
    if (e instanceof FormError) return fail(e.key, formData);
    throw e;
  }
  await audit({ actorId: user.id, orgId, action: "payment.allocate", entity: "Payment", entityId: paymentId, details: { allocations: alloc } });
  revalidate(clientId);
  return { ok: true };
}

/** To'lovni bekor qilish (o'chirilmaydi): taqsimoti hisobdan chiqadi, qarz qaytadi. */
export async function cancelPayment(paymentId: string): Promise<FormState> {
  const { user, orgId } = await editor();
  const p = await db.payment.findFirst({ where: { id: paymentId, orgId, status: "ACTIVE" } });
  if (!p) throw new ForbiddenError();
  await db.payment.update({ where: { id: paymentId }, data: { status: "ARCHIVED" } });
  await audit({ actorId: user.id, orgId, action: "payment.cancel", entity: "Payment", entityId: paymentId });
  revalidate(p.clientId);
  return { ok: true };
}

/** Haydovchi naqd pulni kassaga topshirdi: qaysi naqd kassaga kirim qilingani tanlanadi. */
export async function handOverCash(paymentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await editor();
  const p = await db.payment.findFirst({ where: { id: paymentId, orgId, status: "ACTIVE", receivedBy: "DRIVER", handedOverAt: null } });
  if (!p) throw new ForbiddenError();
  const acc = await pickAccount(orgId, "CASH", p.currency, str(formData, "accountId"));
  if ("error" in acc) return fail(acc.error, formData);
  await db.payment.update({ where: { id: paymentId }, data: { handedOverAt: new Date(), accountId: acc.id } });
  await audit({ actorId: user.id, orgId, action: "payment.handover", entity: "Payment", entityId: paymentId, details: { accountId: acc.id } });
  revalidate(p.clientId);
  revalidatePath("/cash", "layout");
  return { ok: true };
}

/** Tushum hisobini keyin ko'rsatish yoki tuzatish (masalan, kassa ochilishidan oldingi to'lovlar uchun). */
export async function setPaymentAccount(paymentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await editor();
  const p = await db.payment.findFirst({ where: { id: paymentId, orgId, status: "ACTIVE" } });
  if (!p) throw new ForbiddenError();
  // Haydovchidagi (hali topshirilmagan) naqd hech qaysi hisobda emas.
  if (p.receivedBy === "DRIVER" && !p.handedOverAt) return fail("pay.atDriver", formData);
  const kind = p.receivedBy === "DRIVER" ? "CASH" : accountKindFor(p.method, p.receivedBy);
  const acc = await pickAccount(orgId, kind, p.currency, str(formData, "accountId"));
  if ("error" in acc) return fail(acc.error, formData);
  await db.payment.update({ where: { id: paymentId }, data: { accountId: acc.id } });
  await audit({ actorId: user.id, orgId, action: "payment.account", entity: "Payment", entityId: paymentId, details: { from: p.accountId, to: acc.id } });
  revalidate(p.clientId);
  revalidatePath("/cash", "layout");
  return { ok: true };
}
