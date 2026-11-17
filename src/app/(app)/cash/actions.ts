"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AccountKind, Status } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requirePermission, requireSection } from "@/lib/session";
import { orgForWrite, ForbiddenError } from "@/lib/scope";
import { parseDate } from "@/lib/dates";
import { parseAmount } from "@/lib/currency-core";
import { activeCurrencies } from "@/lib/org-currency";
import { tashkentToday } from "@/lib/docs";
import { fail, optStr, str, type FormState } from "@/lib/form";
import { ACCOUNT_KINDS, convertTransfer, normalizeAccountNumber, normalizeCard, normalizeMfo } from "@/lib/cash-core";

/**
 * Kassa yozuvlarini hisobchi va menejer kiritadi (14.11.2026). Tashkilotga bog'langan foydalanuvchi — o'z tashkiloti;
 * barcha tashkilotlar hisobchisi formadagi tashkilotni tanlaydi (u mavjud va faol bo'lishi shart).
 * Kassa bo'limi o'chirilgan tashkilotga yozib bo'lmaydi.
 */
async function writer(formData?: FormData) {
  const user = await requireSection("cash", "EDIT");
  const orgId = orgForWrite(user, formData ? str(formData, "orgId") || null : null);
  const org = await db.organization.findFirst({ where: { id: orgId, status: "ACTIVE", cashEnabled: true } });
  if (!org) throw new ForbiddenError();
  return { user, orgId };
}

/**
 * Bitta yozuv bo'yicha amal (tahrirlash, o'chirish): avval huquq (demo hisob shu yerda to'xtaydi), keyin yozuv;
 * tashkilot yozuvning o'zidan olinadi va foydalanuvchi doirasida tekshiriladi.
 */
async function writerFor<T extends { orgId: string }>(load: () => Promise<T | null>) {
  const user = await requireSection("cash", "EDIT");
  const row = await load();
  if (!row) throw new ForbiddenError();
  const recordOrgId = row.orgId;
  if (user.orgId && user.orgId !== recordOrgId) throw new ForbiddenError();
  const org = await db.organization.findFirst({ where: { id: recordOrgId, status: "ACTIVE", cashEnabled: true } });
  if (!org) throw new ForbiddenError();
  return { user, orgId: recordOrgId, row };
}

function today() {
  return tashkentToday().toISOString().slice(0, 10);
}

function revalidateCash() {
  revalidatePath("/cash", "layout");
}

// ---------- Hisoblar ----------

type AccountInput = {
  kind: AccountKind; name: string; currency: string; mfo: string | null; accountNumber: string | null;
  cardNumber: string | null; cardHolder: string | null; openingBalance: number; note: string | null; untracked: boolean;
};

async function accountInput(orgId: string, formData: FormData): Promise<AccountInput | FormState> {
  const kind = str(formData, "kind") as AccountKind;
  const name = str(formData, "name").slice(0, 100);
  const currency = str(formData, "currency");
  if (!ACCOUNT_KINDS.includes(kind) || !name) return fail("common.required", formData);
  if (!(await activeCurrencies(orgId)).includes(currency)) return fail("trip.error.currency", formData);
  const opening = str(formData, "openingBalance") ? parseAmount(str(formData, "openingBalance")) : 0;
  if (opening === null || Math.abs(opening) > 1e13) return fail("pay.error.amount", formData);
  let mfo: string | null = null, accountNumber: string | null = null, cardNumber: string | null = null, cardHolder: string | null = null;
  if (kind === "BANK") {
    mfo = normalizeMfo(str(formData, "mfo"));
    accountNumber = normalizeAccountNumber(str(formData, "accountNumber"));
    if (!mfo) return fail("cash.error.mfo", formData);
    if (!accountNumber) return fail("cash.error.accountNumber", formData);
  }
  if (kind === "CARD") {
    cardNumber = normalizeCard(str(formData, "cardNumber"));
    cardHolder = optStr(formData, "cardHolder", 100);
    if (!cardNumber) return fail("cash.error.card", formData);
    if (!cardHolder) return fail("cash.error.cardHolder", formData);
  }
  return {
    kind, name, currency, mfo, accountNumber, cardNumber, cardHolder, openingBalance: opening, note: optStr(formData, "note", 300),
    untracked: formData.get("untracked") === "on",
  };
}

async function hasMovements(accountId: string): Promise<boolean> {
  const [p, e, t, x, l] = await Promise.all([
    db.payment.count({ where: { accountId } }),
    db.expense.count({ where: { accountId } }),
    db.cashTransfer.count({ where: { OR: [{ fromAccountId: accountId }, { toAccountId: accountId }] } }),
    db.cashEntry.count({ where: { accountId } }),
    db.driverEntry.count({ where: { accountId } }),
  ]);
  return p + e + t + x + l > 0;
}

export async function createAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await writer(formData);
  const data = await accountInput(orgId, formData);
  if (!("kind" in data)) return data;
  const a = await db.cashAccount.create({ data: { ...data, orgId, createdById: user.id } });
  await audit({ actorId: user.id, orgId, action: "account.create", entity: "CashAccount", entityId: a.id, details: { kind: a.kind, name: a.name, currency: a.currency } });
  revalidateCash();
  return { ok: true };
}

export async function updateAccount(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId, row: a } = await writerFor(() => db.cashAccount.findUnique({ where: { id } }));
  const data = await accountInput(orgId, formData);
  if (!("kind" in data)) return data;
  // Harakati bor hisobning turi va valyutasi o'zgarmaydi (aks holda eski summalar boshqa valyutaga o'tib qoladi).
  if ((data.kind !== a.kind || data.currency !== a.currency) && (await hasMovements(id))) return fail("cash.error.locked", formData);
  await db.cashAccount.update({ where: { id }, data });
  await audit({ actorId: user.id, orgId, action: "account.update", entity: "CashAccount", entityId: id, details: { ...data } });
  revalidateCash();
  return { ok: true };
}

export async function setAccountStatus(id: string, status: Status): Promise<FormState> {
  if (status !== "ACTIVE" && status !== "ARCHIVED") throw new ForbiddenError();
  const { user, orgId } = await writerFor(() => db.cashAccount.findUnique({ where: { id } }));
  await db.cashAccount.update({ where: { id }, data: { status } });
  await audit({ actorId: user.id, orgId, action: "account.status", entity: "CashAccount", entityId: id, details: { status } });
  revalidateCash();
  return { ok: true };
}

// ---------- Xarajatlar ----------

async function expenseInput(orgId: string, formData: FormData) {
  const date = parseDate(formData.get("date"));
  if (!date || date.toISOString().slice(0, 10) > today()) return { error: "pay.error.date" as const };
  const amount = parseAmount(str(formData, "amount"));
  if (amount === null || amount <= 0 || amount > 1e13) return { error: "pay.error.amount" as const };
  const account = await db.cashAccount.findFirst({ where: { id: str(formData, "accountId"), orgId, status: "ACTIVE" } });
  if (!account) return { error: "cash.error.account" as const };
  const cat = await db.expenseCategory.findFirst({
    where: { id: str(formData, "categoryId"), orgId, status: "ACTIVE" },
    include: { parent: true, _count: { select: { children: { where: { status: "ACTIVE" } } } } },
  });
  if (!cat || (cat.parent && cat.parent.status !== "ACTIVE")) return { error: "cash.error.category" as const };
  // Turkum ichida bo'limlar bo'lsa — bo'lim tanlanishi shart.
  if (!cat.parentId && cat._count.children > 0) return { error: "cash.error.subcategory" as const };
  return { data: { date, amount, accountId: account.id, categoryId: cat.id, note: optStr(formData, "note", 300) } };
}

export async function createExpense(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await writer(formData);
  const r = await expenseInput(orgId, formData);
  if ("error" in r) return fail(r.error!, formData);
  const e = await db.expense.create({ data: { ...r.data, orgId, createdById: user.id } });
  await audit({ actorId: user.id, orgId, action: "expense.create", entity: "Expense", entityId: e.id, details: { amount: r.data.amount, accountId: r.data.accountId, categoryId: r.data.categoryId } });
  revalidateCash();
  return { ok: true };
}

export async function updateExpense(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await writerFor(() => db.expense.findFirst({ where: { id, status: "ACTIVE" } }));
  const r = await expenseInput(orgId, formData);
  if ("error" in r) return fail(r.error!, formData);
  await db.expense.update({ where: { id }, data: r.data });
  await audit({ actorId: user.id, orgId, action: "expense.update", entity: "Expense", entityId: id, details: { amount: r.data.amount, accountId: r.data.accountId, categoryId: r.data.categoryId } });
  revalidateCash();
  return { ok: true };
}

/** Xarajatni o'chirish (bazadan o'chmaydi, bekor qilinadi): qoldiq qaytadi, tarix saqlanadi. */
export async function cancelExpense(id: string): Promise<FormState> {
  const { user, orgId } = await writerFor(() => db.expense.findFirst({ where: { id, status: "ACTIVE" } }));
  await db.expense.update({ where: { id }, data: { status: "ARCHIVED" } });
  await audit({ actorId: user.id, orgId, action: "expense.cancel", entity: "Expense", entityId: id });
  revalidateCash();
  return { ok: true };
}

export async function cancelExpenseAndBack(id: string) {
  await cancelExpense(id);
  redirect("/cash/expenses");
}

// ---------- O'tkazmalar ----------

export async function createTransfer(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await writer(formData);
  const date = parseDate(formData.get("date"));
  if (!date || date.toISOString().slice(0, 10) > today()) return fail("pay.error.date", formData);
  const amount = parseAmount(str(formData, "amount"));
  if (amount === null || amount <= 0 || amount > 1e13) return fail("pay.error.amount", formData);
  const [from, to] = await Promise.all([
    db.cashAccount.findFirst({ where: { id: str(formData, "fromAccountId"), orgId, status: "ACTIVE" } }),
    db.cashAccount.findFirst({ where: { id: str(formData, "toAccountId"), orgId, status: "ACTIVE" } }),
  ]);
  if (!from || !to) return fail("cash.error.account", formData);
  if (from.id === to.id) return fail("cash.error.sameAccount", formData);
  let rate: number | null = null;
  let rateBase: string | null = null;
  let toAmount = amount;
  const manual = formData.get("rateManual") === "1";
  if (from.currency !== to.currency) {
    rate = parseAmount(str(formData, "rate"));
    rateBase = str(formData, "rateBase");
    if (!rate || rate <= 0 || rate > 1e9 || (rateBase !== from.currency && rateBase !== to.currency)) return fail("pay.error.rate", formData);
    toAmount = convertTransfer(amount, from.currency, to.currency, rate, rateBase);
    if (toAmount <= 0) return fail("pay.error.rate", formData);
  }
  const t = await db.cashTransfer.create({
    data: { orgId, date, fromAccountId: from.id, toAccountId: to.id, amount, toAmount, rate, rateBase, rateManual: rate ? manual : false, note: optStr(formData, "note", 300), createdById: user.id },
  });
  await audit({ actorId: user.id, orgId, action: "transfer.create", entity: "CashTransfer", entityId: t.id, details: { from: from.id, to: to.id, amount, toAmount, rate, rateBase } });
  revalidateCash();
  return { ok: true };
}

export async function cancelTransfer(id: string): Promise<FormState> {
  const { user, orgId } = await writerFor(() => db.cashTransfer.findFirst({ where: { id, status: "ACTIVE" } }));
  await db.cashTransfer.update({ where: { id }, data: { status: "ARCHIVED" } });
  await audit({ actorId: user.id, orgId, action: "transfer.cancel", entity: "CashTransfer", entityId: id });
  revalidateCash();
  return { ok: true };
}

// ---------- Boshqa kirim / chiqim (tashishlardan tashqari) ----------

/** Ta'sischi yoki rahbar qo'ygan pul, boshqa tashkilotdan yordam (kirim) yoki ularga qaytarilgan pul (chiqim). */
export async function createEntry(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await writer(formData);
  const direction = str(formData, "direction");
  if (direction !== "IN" && direction !== "OUT") return fail("common.required", formData);
  const date = parseDate(formData.get("date"));
  if (!date || date.toISOString().slice(0, 10) > today()) return fail("pay.error.date", formData);
  const amount = parseAmount(str(formData, "amount"));
  if (amount === null || amount <= 0 || amount > 1e13) return fail("pay.error.amount", formData);
  const account = await db.cashAccount.findFirst({ where: { id: str(formData, "accountId"), orgId, status: "ACTIVE" } });
  if (!account) return fail("cash.error.account", formData);
  const party = str(formData, "party").slice(0, 200);
  if (!party) return fail("common.required", formData);
  const e = await db.cashEntry.create({
    data: { orgId, date, accountId: account.id, direction, amount, party, note: optStr(formData, "note", 300), createdById: user.id },
  });
  await audit({ actorId: user.id, orgId, action: "entry.create", entity: "CashEntry", entityId: e.id, details: { direction, amount, accountId: account.id, party } });
  revalidateCash();
  return { ok: true };
}

export async function cancelEntry(id: string): Promise<FormState> {
  const { user, orgId } = await writerFor(() => db.cashEntry.findFirst({ where: { id, status: "ACTIVE" } }));
  await db.cashEntry.update({ where: { id }, data: { status: "ARCHIVED" } });
  await audit({ actorId: user.id, orgId, action: "entry.cancel", entity: "CashEntry", entityId: id });
  revalidateCash();
  return { ok: true };
}

// ---------- Sozlamalar: bo'limni yoqish, xarajat turkumlari (rahbar) ----------

async function settingsOwner() {
  const user = await requirePermission("cash.settings");
  return { user, orgId: orgForWrite(user) };
}

export async function setCashEnabled(enabled: boolean): Promise<FormState> {
  const { user, orgId } = await settingsOwner();
  await db.organization.update({ where: { id: orgId }, data: { cashEnabled: enabled } });
  await audit({ actorId: user.id, orgId, action: "cash.toggle", entity: "Organization", entityId: orgId, details: { enabled } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function addCategory(parentId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await settingsOwner();
  const name = str(formData, "name").slice(0, 80);
  if (!name) return fail("common.required", formData);
  if (parentId) {
    const p = await db.expenseCategory.findFirst({ where: { id: parentId, orgId, parentId: null } });
    if (!p) throw new ForbiddenError();
  }
  const dup = await db.expenseCategory.findFirst({ where: { orgId, parentId, name: { equals: name, mode: "insensitive" }, status: "ACTIVE" } });
  if (dup) return fail("cash.error.categoryExists", formData);
  const c = await db.expenseCategory.create({ data: { orgId, name, parentId } });
  await audit({ actorId: user.id, orgId, action: "category.create", entity: "ExpenseCategory", entityId: c.id, details: { name, parentId } });
  revalidatePath("/settings/cash");
  return { ok: true };
}

export async function renameCategory(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await settingsOwner();
  const c = await db.expenseCategory.findFirst({ where: { id, orgId } });
  if (!c) throw new ForbiddenError();
  const name = str(formData, "name").slice(0, 80);
  if (!name) return fail("common.required", formData);
  await db.expenseCategory.update({ where: { id }, data: { name } });
  await audit({ actorId: user.id, orgId, action: "category.update", entity: "ExpenseCategory", entityId: id, details: { from: c.name, name } });
  revalidatePath("/settings/cash");
  return { ok: true };
}

/** Turkum o'chirilmaydi (eski xarajatlar unga bog'langan) — nofaol bo'ladi va yangi xarajatda tanlanmaydi. */
export async function setCategoryStatus(id: string, status: Status): Promise<FormState> {
  const { user, orgId } = await settingsOwner();
  const c = await db.expenseCategory.findFirst({ where: { id, orgId } });
  if (!c || (status !== "ACTIVE" && status !== "ARCHIVED")) throw new ForbiddenError();
  await db.expenseCategory.update({ where: { id }, data: { status } });
  await audit({ actorId: user.id, orgId, action: "category.status", entity: "ExpenseCategory", entityId: id, details: { status } });
  revalidatePath("/settings/cash");
  return { ok: true };
}
