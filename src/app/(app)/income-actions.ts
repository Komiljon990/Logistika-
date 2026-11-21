"use server";

import { revalidatePath } from "next/cache";
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
import { fail, optStr, str, type FormState } from "@/lib/form";
import { recordClientIncome } from "@/lib/income";
import { addDriverEntry } from "./lessors/actions";
import { createEntry } from "./cash/actions";
import { notifyIncome } from "@/lib/telegram-staff";

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

/** Mijozdan tushum: hisob turi to'lov usulini belgilaydi (bank → shartnoma, naqd/karta → naqd kelishuv). */
async function clientIncome(formData: FormData): Promise<FormState> {
  const user = await requireSection("settlements", "EDIT");
  const orgId = orgForWrite(user);
  const r = await recordClientIncome({
    orgId, userId: user.id, clientId: str(formData, "clientId"), date: parseDate(formData.get("date")), amount: parseAmount(str(formData, "amount")),
    currency: str(formData, "currency"), method: str(formData, "method"), accountId: str(formData, "accountId") || null,
    note: optStr(formData, "note", 300), auditExtra: { quick: true },
  });
  if (!r.ok) return fail(r.error, formData);
  void notifyIncome("payment", r.paymentId, user.id);
  revalidatePath(`/clients/${r.clientId}`);
  revalidatePath("/settlements");
  revalidatePath("/cash", "layout");
  for (const id of r.tripIds) revalidatePath(`/trips/${id}`);
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
