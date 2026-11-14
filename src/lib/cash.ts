import "server-only";
import { db } from "./db";
import { tashkentToday } from "./docs";
import { accountLabel, balance, type AccountKind, type Movement } from "./cash-core";

export type AccountRow = {
  id: string; kind: AccountKind; name: string; mfo: string | null; accountNumber: string | null;
  cardNumber: string | null; cardHolder: string | null; currency: string; openingBalance: number;
  note: string | null; active: boolean; label: string;
};

/** Formalar uchun qisqa ko'rinish (to'lov, topshirish, xarajat, o'tkazma). */
export type AccountOption = { id: string; kind: AccountKind; currency: string; label: string };

export async function cashEnabled(orgId: string): Promise<boolean> {
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { cashEnabled: true } });
  return !!org?.cashEnabled;
}

export async function loadAccounts(orgId: string, withArchived = false): Promise<AccountRow[]> {
  const rows = await db.cashAccount.findMany({
    where: { orgId, ...(withArchived ? {} : { status: "ACTIVE" }) },
    orderBy: [{ status: "asc" }, { kind: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((a) => ({
    id: a.id, kind: a.kind, name: a.name, mfo: a.mfo, accountNumber: a.accountNumber, cardNumber: a.cardNumber,
    cardHolder: a.cardHolder, currency: a.currency, openingBalance: Number(a.openingBalance), note: a.note,
    active: a.status === "ACTIVE", label: accountLabel(a),
  }));
}

/**
 * To'lov formasi uchun hisoblar. `required` — kassa yoqilgan va kamida bitta faol hisob ochilgan:
 * shunda to'lov qaysi hisobga tushgani majburiy (hisob ochilmagan tashkilot ishini to'xtatmaslik uchun).
 */
export async function paymentAccounts(orgId: string): Promise<{ options: AccountOption[]; required: boolean }> {
  if (!(await cashEnabled(orgId))) return { options: [], required: false };
  const rows = await loadAccounts(orgId);
  return { options: rows.map(({ id, kind, currency, label }) => ({ id, kind, currency, label })), required: rows.length > 0 };
}

/** Toshkent vaqti bo'yicha kun (haydovchi topshirgan vaqt — DateTime). */
export function tashkentDay(d: Date): string {
  return tashkentToday(d).toISOString().slice(0, 10);
}

export type MovementRow = Movement & {
  id: string; kind: "payment" | "expense" | "transferIn" | "transferOut"; currency: string;
  title: string; sub: string | null; href: string | null; createdById: string;
};

/**
 * Tashkilotning barcha hisob harakatlari (bekor qilinganlarsiz):
 * to'lovlar (+), xarajatlar (−), o'tkazmalar (chiqqan hisobdan −, tushgan hisobga +).
 * Haydovchi olgan naqd — topshirilgan kuni kassaga kirim.
 */
export async function loadMovements(orgId: string, opts: { to?: string; accountId?: string } = {}): Promise<MovementRow[]> {
  const acc = opts.accountId;
  const [payments, expenses, transfers] = await Promise.all([
    db.payment.findMany({
      where: { orgId, status: "ACTIVE", accountId: acc ?? { not: null } },
      include: { client: { select: { name: true } }, driver: { select: { fullName: true } } },
    }),
    db.expense.findMany({
      where: { orgId, status: "ACTIVE", ...(acc ? { accountId: acc } : {}) },
      include: { category: { select: { name: true, parent: { select: { name: true } } } }, account: { select: { currency: true } } },
    }),
    db.cashTransfer.findMany({
      where: { orgId, status: "ACTIVE", ...(acc ? { OR: [{ fromAccountId: acc }, { toAccountId: acc }] } : {}) },
      include: { fromAccount: { select: { name: true, currency: true } }, toAccount: { select: { name: true, currency: true } } },
    }),
  ]);
  const out: MovementRow[] = [];
  for (const p of payments) {
    const day = p.receivedBy === "DRIVER" && p.handedOverAt ? tashkentDay(p.handedOverAt) : p.date.toISOString().slice(0, 10);
    out.push({
      id: p.id, kind: "payment", accountId: p.accountId!, day, amount: Number(p.amount), currency: p.currency,
      title: p.client.name, sub: [p.driver ? p.driver.fullName : null, p.note].filter(Boolean).join(" · ") || null,
      href: `/clients/${p.clientId}`, createdById: p.createdById,
    });
  }
  for (const e of expenses) {
    out.push({
      id: e.id, kind: "expense", accountId: e.accountId, day: e.date.toISOString().slice(0, 10), amount: -Number(e.amount), currency: e.account.currency,
      title: e.category.parent ? `${e.category.parent.name} › ${e.category.name}` : e.category.name, sub: e.note,
      href: `/cash/expenses/${e.id}`, createdById: e.createdById,
    });
  }
  for (const t of transfers) {
    const day = t.date.toISOString().slice(0, 10);
    if (!acc || t.fromAccountId === acc) {
      out.push({
        id: t.id, kind: "transferOut", accountId: t.fromAccountId, day, amount: -Number(t.amount), currency: t.fromAccount.currency,
        title: t.toAccount.name, sub: t.note, href: null, createdById: t.createdById,
      });
    }
    if (!acc || t.toAccountId === acc) {
      out.push({
        id: t.id, kind: "transferIn", accountId: t.toAccountId, day, amount: Number(t.toAmount), currency: t.toAccount.currency,
        title: t.fromAccount.name, sub: t.note, href: null, createdById: t.createdById,
      });
    }
  }
  const filtered = opts.to ? out.filter((m) => m.day <= opts.to!) : out;
  return filtered.sort((a, b) => (a.day === b.day ? 0 : a.day < b.day ? 1 : -1));
}

/** Har hisobning joriy qoldig'i. */
export function balances(accounts: AccountRow[], movements: Movement[]): Map<string, number> {
  return new Map(accounts.map((a) => [a.id, balance(a.openingBalance, movements.filter((m) => m.accountId === a.id))]));
}

/** Yangi tashkilotga namuna turkumlar (rahbar o'zgartiradi, o'chiradi, yangisini qo'shadi). */
const DEFAULT_CATEGORIES: [string, string[]][] = [
  ["Yoqilg'i", ["Dizel", "Gaz", "AdBlue"]],
  ["Ta'mirlash va xizmat", ["Ehtiyot qismlar", "Shina", "Moy almashtirish", "Usta xizmati"]],
  ["Yo'l xarajatlari", ["Bojxona", "Yo'l haqi", "Jarima", "To'xtash joyi"]],
  ["Ish haqi", ["Haydovchilar", "Ofis xodimlari"]],
  ["Ofis", ["Ijara", "Kommunal", "Aloqa va internet"]],
  ["Soliq va bank", ["Soliqlar", "Bank xizmati"]],
];

export async function seedCategories(orgId: string) {
  if ((await db.expenseCategory.count({ where: { orgId } })) > 0) return;
  for (const [name, subs] of DEFAULT_CATEGORIES) {
    const parent = await db.expenseCategory.create({ data: { orgId, name } });
    await db.expenseCategory.createMany({ data: subs.map((s) => ({ orgId, name: s, parentId: parent.id })) });
  }
}

export type CategoryTree = { id: string; name: string; active: boolean; children: { id: string; name: string; active: boolean }[] }[];

export async function loadCategories(orgId: string, withArchived = false): Promise<CategoryTree> {
  await seedCategories(orgId);
  const rows = await db.expenseCategory.findMany({
    where: { orgId, ...(withArchived ? {} : { status: "ACTIVE" }) },
    orderBy: [{ createdAt: "asc" }],
  });
  return rows
    .filter((r) => !r.parentId)
    .map((p) => ({
      id: p.id, name: p.name, active: p.status === "ACTIVE",
      children: rows.filter((c) => c.parentId === p.id).map((c) => ({ id: c.id, name: c.name, active: c.status === "ACTIVE" })),
    }));
}
