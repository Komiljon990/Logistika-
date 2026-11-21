// "server-only" import qilinmaydi (21.11.2026): saytdagi «+ Kirim» va Telegram botdagi ovozli kiritish shu yerdan yozadi.
import type { Dict } from "@/i18n";
import { db } from "./db";
import { audit } from "./audit";
import { activeCurrencies } from "./org-currency";
import { cashEnabled } from "./cash";
import { tashkentToday } from "./docs";
import { autoAllocate, checkAllocations, shipmentTotals, type Method, type OpenShipment } from "./settlement-core";
import { BILLABLE_CHARGES } from "./charges";

export type ClientIncomeInput = {
  orgId: string;
  userId: string;
  clientId: string;
  date: Date | null;
  amount: number | null;
  currency: string;
  method: string;
  /** Kassa yoqilgan va hisob ochilgan bo'lsa majburiy: valyuta va to'lov turi hisobdan olinadi. */
  accountId: string | null;
  note: string | null;
  /** Audit uchun qo'shimcha (masalan, { quick: true } yoki { source: "telegram-voice" }). */
  auditExtra?: Record<string, string | number | boolean>;
};

export type ClientIncomeResult = { ok: true; paymentId: string; clientId: string; tripIds: string[] } | { ok: false; error: keyof Dict };

class FormError extends Error {
  constructor(public key: keyof Dict) { super(key); }
}

/**
 * Mijozdan tushum (17.11.2026, 21.11.2026 da alohida funksiyaga ajratildi): eng eski qarzlarga shu valyutada
 * avtomatik taqsimlanadi, qolgani avans. Hisob turi to'lov usulini belgilaydi (bank → shartnoma, naqd/karta → naqd kelishuv).
 * Huquq (settlements EDIT) chaqiruvchi tomonidan tekshiriladi.
 */
export async function recordClientIncome(input: ClientIncomeInput): Promise<ClientIncomeResult> {
  const { orgId, userId, date, amount } = input;
  const client = await db.client.findFirst({ where: { id: input.clientId, orgId } });
  if (!client) return { ok: false, error: "income.error.client" };
  if (!date || date.toISOString().slice(0, 10) > tashkentToday().toISOString().slice(0, 10)) return { ok: false, error: "pay.error.date" };
  if (amount === null || !Number.isFinite(amount) || amount <= 0 || amount > 1e13) return { ok: false, error: "pay.error.amount" };
  const cashOn = await cashEnabled(orgId);
  const accountsExist = cashOn && (await db.cashAccount.count({ where: { orgId, status: "ACTIVE" } })) > 0;
  let accountId: string | null = null;
  let currency = input.currency;
  let method = input.method as Method;
  if (accountsExist) {
    const account = input.accountId ? await db.cashAccount.findFirst({ where: { id: input.accountId, orgId, status: "ACTIVE" } }) : null;
    if (!account) return { ok: false, error: "cash.error.account" };
    accountId = account.id;
    currency = account.currency;
    method = account.kind;
  }
  if (!["BANK", "CASH", "CARD"].includes(method)) return { ok: false, error: "common.required" };
  if (!(await activeCurrencies(orgId)).includes(currency)) return { ok: false, error: "trip.error.currency" };
  let paymentId: string;
  let tripIds: string[] = [];
  try {
    paymentId = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${orgId}))::text`;
      const ships = await tx.shipment.findMany({
        where: { orgId, clientId: client.id, status: "ACTIVE", trip: { status: { not: "CANCELLED" }, listOnly: false } },
        include: { charges: { where: BILLABLE_CHARGES, select: { amount: true } }, allocations: { where: { payment: { status: "ACTIVE" } }, select: { applied: true } } },
        orderBy: { createdAt: "asc" },
      });
      const open = new Map<string, OpenShipment>(ships.map((s, i) => {
        const tot = shipmentTotals(Number(s.price), s.charges.map((c) => Number(c.amount)), s.allocations.map((a) => Number(a.applied)));
        return [s.id, { id: s.id, currency: s.currency, remaining: tot.remaining, terms: s.terms, order: i }];
      }));
      // Faqat shu valyutadagi qarzlar avtomatik yopiladi (kurs talab qilinmaydi); qolgani avans.
      const alloc = autoAllocate(amount, method, [...open.values()], (c) => (c === currency ? 1 : null));
      const check = checkAllocations(amount, method, alloc, open);
      if (!check.ok) throw new FormError(check.error);
      const p = await tx.payment.create({
        data: { orgId, clientId: client.id, date, amount, currency, method, receivedBy: method === "CASH" ? "OFFICE" : null, accountId, note: input.note, createdById: userId },
      });
      if (alloc.length) {
        await tx.paymentAllocation.createMany({ data: alloc.map((a, i) => ({ paymentId: p.id, shipmentId: a.shipmentId, applied: a.applied, consumed: check.consumed[i], rate: a.rate })) });
      }
      tripIds = ships.filter((s) => alloc.some((a) => a.shipmentId === s.id)).map((s) => s.tripId);
      return p.id;
    });
  } catch (e) {
    if (e instanceof FormError) return { ok: false, error: e.key };
    throw e;
  }
  await audit({
    actorId: userId, orgId, action: "payment.create", entity: "Payment", entityId: paymentId,
    details: { clientId: client.id, amount, currency, method, accountId, ...(input.auditExtra ?? {}) },
  });
  return { ok: true, paymentId, clientId: client.id, tripIds: [...new Set(tripIds)] };
}
