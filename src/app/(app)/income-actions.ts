"use server";

import { revalidatePath } from "next/cache";
import type { Dict } from "@/i18n";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireSection, requireUser } from "@/lib/session";
import { canEdit } from "@/lib/access";
import { orgForWrite, ForbiddenError } from "@/lib/scope";
import { parseDate } from "@/lib/dates";
import { parseAmount } from "@/lib/currency-core";
import { activeCurrencies } from "@/lib/org-currency";
import { tashkentToday } from "@/lib/docs";
import { cashEnabled, loadAccounts } from "@/lib/cash";
import { lockOrg } from "@/lib/trips";
import { fail, optStr, str, type FormState } from "@/lib/form";
import { autoAllocate, checkAllocations, shipmentTotals, type Method, type OpenShipment } from "@/lib/settlement-core";
import { addDriverEntry } from "./lessors/actions";
import { createEntry } from "./cash/actions";
import { notifyIncome } from "@/lib/telegram-staff";
import { BILLABLE_CHARGES } from "@/lib/charges";

/**
 * Yuqoridagi "+ Kirim" tugmasi (17.11.2026): tushum kimdan, qancha va qayerga tushgani bitta oynada.
 * Mijozdan — to'lov (eng eski qarzlarga avtomatik taqsimlanadi, qolgani avans); ijarachidan — uning hisobiga to'lov;
 * boshqa — kassaga boshqa kirim. Har biri o'z bo'limidagi huquq bilan tekshiriladi.
 */
export type IncomeOptions = {
  clients: { id: string; label: string }[];
  lessors: { id: string; label: string }[];
  accounts: { id: string; label: string; currency: string; kind: "BANK" | "CASH" | "CARD" }[];
  currencies: string[];
  can: { client: boolean; lessor: boolean; other: boolean };
  today: string;
};

export async function incomeOptions(): Promise<IncomeOptions> {
  const user = await requireUser();
  const orgId = orgForWrite(user);
  const cashOn = await cashEnabled(orgId);
  const can = { client: canEdit(user, "settlements"), lessor: canEdit(user, "lessors"), other: cashOn && canEdit(user, "cash") };
  const [clients, lessors, accounts, currencies] = await Promise.all([
    can.client ? db.client.findMany({ where: { orgId, status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : [],
    can.lessor ? db.driver.findMany({ where: { orgId, status: "ACTIVE", category: "OWNER_OPERATOR" }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }) : [],
    cashOn ? loadAccounts(orgId) : [],
    activeCurrencies(orgId),
  ]);
  return {
    clients: clients.map((c) => ({ id: c.id, label: c.name })),
    lessors: lessors.map((l) => ({ id: l.id, label: l.fullName })),
    accounts: accounts.map((a) => ({ id: a.id, label: a.label, currency: a.currency, kind: a.kind })),
    currencies,
    can,
    today: tashkentToday().toISOString().slice(0, 10),
  };
}

class FormError extends Error {
  constructor(public key: keyof Dict) { super(key); }
}

/** Mijozdan tushum: hisob turi to'lov usulini belgilaydi (bank → shartnoma, naqd/karta → naqd kelishuv). */
async function clientIncome(formData: FormData): Promise<FormState> {
  const user = await requireSection("settlements", "EDIT");
  const orgId = orgForWrite(user);
  const client = await db.client.findFirst({ where: { id: str(formData, "clientId"), orgId } });
  if (!client) return fail("income.error.client", formData);
  const date = parseDate(formData.get("date"));
  if (!date || date.toISOString().slice(0, 10) > tashkentToday().toISOString().slice(0, 10)) return fail("pay.error.date", formData);
  const amount = parseAmount(str(formData, "amount"));
  if (amount === null || amount <= 0 || amount > 1e13) return fail("pay.error.amount", formData);
  const cashOn = await cashEnabled(orgId);
  const accountsExist = cashOn && (await db.cashAccount.count({ where: { orgId, status: "ACTIVE" } })) > 0;
  let accountId: string | null = null;
  let currency = str(formData, "currency");
  let method = str(formData, "method") as Method;
  if (accountsExist) {
    const account = await db.cashAccount.findFirst({ where: { id: str(formData, "accountId"), orgId, status: "ACTIVE" } });
    if (!account) return fail("cash.error.account", formData);
    accountId = account.id;
    currency = account.currency;
    method = account.kind;
  }
  if (!["BANK", "CASH", "CARD"].includes(method)) return fail("common.required", formData);
  if (!(await activeCurrencies(orgId)).includes(currency)) return fail("trip.error.currency", formData);
  let paymentId: string;
  let tripIds: string[] = [];
  try {
    paymentId = await db.$transaction(async (tx) => {
      await lockOrg(tx, orgId);
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
        data: {
          orgId, clientId: client.id, date, amount, currency, method, receivedBy: method === "CASH" ? "OFFICE" : null, accountId,
          note: optStr(formData, "note", 300), createdById: user.id,
        },
      });
      if (alloc.length) {
        await tx.paymentAllocation.createMany({ data: alloc.map((a, i) => ({ paymentId: p.id, shipmentId: a.shipmentId, applied: a.applied, consumed: check.consumed[i], rate: a.rate })) });
      }
      tripIds = ships.filter((s) => alloc.some((a) => a.shipmentId === s.id)).map((s) => s.tripId);
      return p.id;
    });
  } catch (e) {
    if (e instanceof FormError) return fail(e.key, formData);
    throw e;
  }
  await audit({ actorId: user.id, orgId, action: "payment.create", entity: "Payment", entityId: paymentId, details: { clientId: client.id, amount, currency, method, accountId, quick: true } });
  void notifyIncome("payment", paymentId, user.id);
  revalidatePath(`/clients/${client.id}`);
  revalidatePath("/settlements");
  revalidatePath("/cash", "layout");
  for (const id of new Set(tripIds)) revalidatePath(`/trips/${id}`);
  return { ok: true };
}

export async function quickIncome(_prev: FormState, formData: FormData): Promise<FormState> {
  const source = str(formData, "source");
  if (source === "client") return clientIncome(formData);
  if (source === "lessor") {
    const driverId = str(formData, "lessorId");
    if (!driverId) return fail("income.error.lessor", formData);
    const user = await requireSection("lessors", "EDIT");
    if (!(await db.driver.findFirst({ where: { id: driverId, orgId: orgForWrite(user) } }))) throw new ForbiddenError();
    return addDriverEntry(driverId, "LESSOR", "PAYMENT", {}, formData);
  }
  if (source === "other") {
    formData.set("direction", "IN");
    return createEntry({}, formData);
  }
  return fail("common.required", formData);
}
