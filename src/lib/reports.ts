import "server-only";
import { db } from "./db";
import { loadAccounts, loadMovements } from "./cash";
import { BILLABLE_CHARGES } from "./charges";

/** Valyuta bo'yicha summalar: { USD: 1200, UZS: 5_000_000 }. */
export type Money = Record<string, number>;

const add = (m: Money, cur: string, v: number) => { m[cur] = Math.round(((m[cur] ?? 0) + v) * 100) / 100; };

export type TripGroup = { key: string; label: string; sub?: string; trips: number; revenue: Money };

/**
 * Reyslar hisoboti: davr (yuklash sanasi bo'yicha), bekor qilinganlar kirmaydi. Daromad = yuk qismlari narxi +
 * qo'shimcha xarajat va prostoy (mijozga hisoblangan), har valyuta alohida.
 */
export async function tripsReport(orgId: string, from: string, to: string) {
  const trips = await db.trip.findMany({
    where: { orgId, status: { not: "CANCELLED" }, loadDate: { gte: new Date(from), lte: new Date(to) } },
    include: {
      tractor: { select: { id: true, plate: true } },
      driver: { select: { id: true, fullName: true } },
      shipments: {
        where: { status: "ACTIVE" },
        include: { client: { select: { id: true, name: true } }, charges: { where: BILLABLE_CHARGES, select: { amount: true } } },
      },
    },
  });
  const byTractor = new Map<string, TripGroup>();
  const byDriver = new Map<string, TripGroup>();
  const byClient = new Map<string, TripGroup>();
  const total: Money = {};
  const routes = new Map<string, TripGroup>();
  let completed = 0;
  let listOnly = 0;
  for (const tr of trips) {
    if (tr.status === "COMPLETED") completed++;
    if (tr.listOnly) listOnly++;
    const rev: Money = {};
    // "Faqat ro'yxat" tashishi soniga kiradi, daromadga — yo'q.
    for (const s of tr.listOnly ? [] : tr.shipments) {
      const v = Number(s.price) + s.charges.reduce((a, c) => a + Number(c.amount), 0);
      add(rev, s.currency, v);
      const g = byClient.get(s.client.id) ?? { key: s.client.id, label: s.client.name, trips: 0, revenue: {} };
      g.trips++;
      add(g.revenue, s.currency, v);
      byClient.set(s.client.id, g);
    }
    for (const [cur, v] of Object.entries(rev)) add(total, cur, v);
    const put = (map: Map<string, TripGroup>, key: string, label: string) => {
      const g = map.get(key) ?? { key, label, trips: 0, revenue: {} };
      g.trips++;
      for (const [cur, v] of Object.entries(rev)) add(g.revenue, cur, v);
      map.set(key, g);
    };
    put(byTractor, tr.tractor.id, tr.tractor.plate);
    put(byDriver, tr.driver.id, tr.driver.fullName);
    put(routes, `${tr.routeFrom} → ${tr.routeTo}`, `${tr.routeFrom} → ${tr.routeTo}`);
  }
  const sort = (m: Map<string, TripGroup>) => [...m.values()].sort((a, b) => b.trips - a.trips || a.label.localeCompare(b.label));
  return {
    count: trips.length, completed, listOnly, total,
    byTractor: sort(byTractor), byDriver: sort(byDriver), byClient: sort(byClient), routes: sort(routes).slice(0, 15),
  };
}

/** Reys rentabelligi qatori (18.11.2026). */
export type ProfitRow = {
  id: string; number: number; route: string; plate: string; driver: string; loadDate: Date; status: string;
  revenue: Money; expenses: Money; driverPay: Money; profit: Money;
};

/**
 * Reys rentabelligi: daromad (yuk narxi + mijozga qo'shimcha hisoblar) − reysga bog'langan xarajatlar (kassa)
 * − haydovchiga reys uchun hisoblangan summa. Har valyuta alohida (kurs bilan aralashtirilmaydi).
 * Davr — yuklash sanasi bo'yicha; bekor qilingan va "faqat ro'yxat" reyslar kirmaydi.
 */
export async function profitReport(orgId: string, from: string, to: string) {
  const trips = await db.trip.findMany({
    where: { orgId, status: { not: "CANCELLED" }, listOnly: false, loadDate: { gte: new Date(from), lte: new Date(to) } },
    orderBy: { number: "desc" },
    include: {
      tractor: { select: { plate: true } },
      driver: { select: { fullName: true } },
      shipments: { where: { status: "ACTIVE" }, select: { price: true, currency: true, charges: { where: BILLABLE_CHARGES, select: { amount: true } } } },
      expenses: { where: { status: "ACTIVE" }, select: { amount: true, account: { select: { currency: true } } } },
      driverEntries: { where: { status: "ACTIVE", kind: "CHARGE", side: "STAFF" }, select: { amount: true, currency: true } },
    },
  });
  const total = { revenue: {} as Money, expenses: {} as Money, driverPay: {} as Money, profit: {} as Money };
  const rows: ProfitRow[] = trips.map((tr) => {
    const r: ProfitRow = {
      id: tr.id, number: tr.number, route: `${tr.routeFrom} → ${tr.routeTo}`, plate: tr.tractor.plate, driver: tr.driver.fullName,
      loadDate: tr.loadDate, status: tr.status, revenue: {}, expenses: {}, driverPay: {}, profit: {},
    };
    for (const s of tr.shipments) {
      const v = Number(s.price) + s.charges.reduce((a, c) => a + Number(c.amount), 0);
      add(r.revenue, s.currency, v);
      add(r.profit, s.currency, v);
    }
    for (const e of tr.expenses) { add(r.expenses, e.account.currency, Number(e.amount)); add(r.profit, e.account.currency, -Number(e.amount)); }
    for (const e of tr.driverEntries) { add(r.driverPay, e.currency, Number(e.amount)); add(r.profit, e.currency, -Number(e.amount)); }
    for (const k of ["revenue", "expenses", "driverPay", "profit"] as const) for (const [cur, v] of Object.entries(r[k])) add(total[k], cur, v);
    return r;
  });
  const withCosts = rows.filter((r) => Object.keys(r.expenses).length || Object.keys(r.driverPay).length).length;
  return { rows, total, withCosts };
}

export type FinanceRow = {
  month: string; payments: Money; lessorIn: Money; otherIn: Money; expenses: Money; driverPay: Money; otherOut: Money; toUntracked: Money; net: Money;
};
const FIN_KEYS = ["payments", "lessorIn", "otherIn", "expenses", "driverPay", "otherOut", "toUntracked", "net"] as const;
const emptyFin = (month: string): FinanceRow => ({ month, payments: {}, lessorIn: {}, otherIn: {}, expenses: {}, driverPay: {}, otherOut: {}, toUntracked: {}, net: {} });

/**
 * Pul oqimi oylar bo'yicha (faqat aylanmasi yuritiladigan hisoblar): mijozlardan tushum, boshqa kirim, xarajatlar,
 * boshqa chiqim va aylanmasiz hisoblarga (masalan rahbar kartasiga) o'tkazilgan pul. Hisoblar orasidagi ichki
 * o'tkazmalar kirmaydi.
 */
export async function financeReport(orgId: string, from: string, to: string) {
  const accounts = await loadAccounts(orgId, true);
  const tracked = new Set(accounts.filter((a) => !a.untracked).map((a) => a.id));
  const movements = (await loadMovements(orgId)).filter((m) => m.day >= from && m.day <= to && tracked.has(m.accountId));
  const transferTargets = await db.cashTransfer.findMany({
    where: { orgId, status: "ACTIVE", date: { gte: new Date(from), lte: new Date(to) } },
    select: { id: true, toAccountId: true, fromAccountId: true },
  });
  const toUntrackedIds = new Set(transferTargets.filter((x) => !tracked.has(x.toAccountId)).map((x) => x.id));
  // Aylanmasiz hisobdan kassaga qaytgan pul — boshqa kirim sifatida.
  const fromUntrackedIds = new Set(transferTargets.filter((x) => !tracked.has(x.fromAccountId)).map((x) => x.id));
  const rows = new Map<string, FinanceRow>();
  const row = (month: string) => {
    let r = rows.get(month);
    if (!r) { r = emptyFin(month); rows.set(month, r); }
    return r;
  };
  for (const m of movements) {
    const r = row(m.day.slice(0, 7));
    const v = Math.abs(m.amount);
    if (m.kind === "payment") add(r.payments, m.currency, v);
    else if (m.kind === "entryIn" || (m.kind === "transferIn" && fromUntrackedIds.has(m.id))) add(r.otherIn, m.currency, v);
    else if (m.kind === "lessorIn") add(r.lessorIn, m.currency, v);
    else if (m.kind === "expense") add(r.expenses, m.currency, v);
    else if (m.kind === "driverPay") add(r.driverPay, m.currency, v);
    else if (m.kind === "entryOut") add(r.otherOut, m.currency, v);
    else if (m.kind === "transferOut" && toUntrackedIds.has(m.id)) add(r.toUntracked, m.currency, v);
    else continue; // ichki o'tkazma
    add(r.net, m.currency, m.amount);
  }
  const list = [...rows.values()].sort((a, b) => (a.month < b.month ? -1 : 1));
  const total = emptyFin("");
  for (const r of list) {
    for (const k of FIN_KEYS) {
      for (const [cur, v] of Object.entries(r[k])) add(total[k], cur, v);
    }
  }
  return { rows: list, total };
}

export type CategoryRow = { name: string; total: Money; children: { name: string; total: Money }[] };

/** Xarajatlar turkum va bo'lim bo'yicha (davr ichida, bekor qilinganlarsiz). */
export async function expensesReport(orgId: string, from: string, to: string) {
  const expenses = await db.expense.findMany({
    where: { orgId, status: "ACTIVE", date: { gte: new Date(from), lte: new Date(to) } },
    include: { account: { select: { currency: true } }, category: { select: { name: true, parent: { select: { name: true } } } } },
  });
  const tree = new Map<string, { total: Money; children: Map<string, Money> }>();
  const total: Money = {};
  for (const e of expenses) {
    const top = e.category.parent?.name ?? e.category.name;
    const sub = e.category.parent ? e.category.name : null;
    const node = tree.get(top) ?? { total: {}, children: new Map<string, Money>() };
    const v = Number(e.amount);
    add(node.total, e.account.currency, v);
    add(total, e.account.currency, v);
    if (sub) {
      const c = node.children.get(sub) ?? {};
      add(c, e.account.currency, v);
      node.children.set(sub, c);
    }
    tree.set(top, node);
  }
  const rows: CategoryRow[] = [...tree.entries()].map(([name, n]) => ({ name, total: n.total, children: [...n.children.entries()].map(([cn, t]) => ({ name: cn, total: t })) }));
  return { rows, total, count: expenses.length };
}

export type LedgerReportRow = { id: string; name: string; plates: string[]; byType: Record<string, Money>; charged: Money; paid: Money; debt: Money };

/**
 * Ijarachilar (LESSOR) yoki xodim haydovchilar (STAFF) bo'yicha hisobot: davr ichida hisob turi bo'yicha
 * hisoblangan, to'langan va bugungi umumiy qarz (barcha davr).
 */
export async function ledgerReport(orgId: string, from: string, to: string, side: "LESSOR" | "STAFF") {
  const drivers = await db.driver.findMany({
    where: { orgId, OR: [{ category: side === "LESSOR" ? "OWNER_OPERATOR" : "EMPLOYEE", status: "ACTIVE" }, { entries: { some: { side, status: "ACTIVE" } } }] },
    orderBy: { fullName: "asc" },
    include: {
      entries: { where: { side, status: "ACTIVE" }, select: { kind: true, type: true, amount: true, currency: true, date: true } },
      ownedVehicles: { where: { status: "ACTIVE" }, select: { plate: true } },
    },
  });
  const total: LedgerReportRow = { id: "", name: "", plates: [], byType: {}, charged: {}, paid: {}, debt: {} };
  const rows: LedgerReportRow[] = [];
  for (const d of drivers) {
    const r: LedgerReportRow = { id: d.id, name: d.fullName, plates: d.ownedVehicles.map((v) => v.plate), byType: {}, charged: {}, paid: {}, debt: {} };
    for (const e of d.entries) {
      const v = Number(e.amount);
      const day = e.date.toISOString().slice(0, 10);
      const sign = e.kind === "CHARGE" ? 1 : -1;
      add(r.debt, e.currency, sign * v);
      add(total.debt, e.currency, sign * v);
      if (day < from || day > to) continue;
      if (e.kind === "CHARGE") {
        const k = e.type ?? "OTHER";
        add((r.byType[k] ??= {}), e.currency, v);
        add((total.byType[k] ??= {}), e.currency, v);
        add(r.charged, e.currency, v);
        add(total.charged, e.currency, v);
      } else {
        add(r.paid, e.currency, v);
        add(total.paid, e.currency, v);
      }
    }
    rows.push(r);
  }
  return { rows, total };
}

/** TIR yoki dazvol (alohida): davrdagi harakatlar soni, hozirgi holat (dazvol — qog'oz/elektron bo'yicha) va haydovchilarga berilgani. */
export async function permitsReport(orgId: string, from: string, to: string, type: "TIR" | "DAZVOL") {
  const range = { gte: new Date(from), lte: new Date(to) };
  const [moves, status, issued] = await Promise.all([
    db.permitMove.groupBy({ by: ["kind"], where: { orgId, date: range, permit: { type } }, _count: true }),
    db.permit.groupBy({ by: ["status", "format"], where: { orgId, type }, _count: true }),
    db.permitMove.findMany({ where: { orgId, kind: "ISSUED", date: range, permit: { type } }, select: { driverName: true } }),
  ]);
  const byDriver = new Map<string, number>();
  for (const m of issued) byDriver.set(m.driverName ?? "—", (byDriver.get(m.driverName ?? "—") ?? 0) + 1);
  return { moves, status, byDriver: [...byDriver.entries()].sort((a, b) => b[1] - a[1]) };
}