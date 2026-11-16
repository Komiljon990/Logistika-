import "server-only";
import { db } from "./db";
import { loadAccounts, loadMovements } from "./cash";

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
        include: { client: { select: { id: true, name: true } }, charges: { where: { status: "ACTIVE" }, select: { amount: true } } },
      },
    },
  });
  const byTractor = new Map<string, TripGroup>();
  const byDriver = new Map<string, TripGroup>();
  const byClient = new Map<string, TripGroup>();
  const total: Money = {};
  const routes = new Map<string, TripGroup>();
  let completed = 0;
  for (const tr of trips) {
    if (tr.status === "COMPLETED") completed++;
    const rev: Money = {};
    for (const s of tr.shipments) {
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
    count: trips.length, completed, total,
    byTractor: sort(byTractor), byDriver: sort(byDriver), byClient: sort(byClient), routes: sort(routes).slice(0, 15),
  };
}

export type FinanceRow = { month: string; payments: Money; otherIn: Money; expenses: Money; otherOut: Money; toUntracked: Money; net: Money };

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
    if (!r) { r = { month, payments: {}, otherIn: {}, expenses: {}, otherOut: {}, toUntracked: {}, net: {} }; rows.set(month, r); }
    return r;
  };
  for (const m of movements) {
    const r = row(m.day.slice(0, 7));
    const v = Math.abs(m.amount);
    if (m.kind === "payment") add(r.payments, m.currency, v);
    else if (m.kind === "entryIn" || (m.kind === "transferIn" && fromUntrackedIds.has(m.id))) add(r.otherIn, m.currency, v);
    else if (m.kind === "expense") add(r.expenses, m.currency, v);
    else if (m.kind === "entryOut") add(r.otherOut, m.currency, v);
    else if (m.kind === "transferOut" && toUntrackedIds.has(m.id)) add(r.toUntracked, m.currency, v);
    else continue; // ichki o'tkazma
    add(r.net, m.currency, m.amount);
  }
  const list = [...rows.values()].sort((a, b) => (a.month < b.month ? -1 : 1));
  const total: FinanceRow = { month: "", payments: {}, otherIn: {}, expenses: {}, otherOut: {}, toUntracked: {}, net: {} };
  for (const r of list) {
    for (const k of ["payments", "otherIn", "expenses", "otherOut", "toUntracked", "net"] as const) {
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

/** TIR / dazvol: davrdagi harakatlar soni va hozirgi holat. */
export async function permitsReport(orgId: string, from: string, to: string) {
  const [moves, status, issued] = await Promise.all([
    db.permitMove.groupBy({ by: ["kind"], where: { orgId, date: { gte: new Date(from), lte: new Date(to) } }, _count: true }),
    db.permit.groupBy({ by: ["type", "status"], where: { orgId }, _count: true }),
    db.permitMove.findMany({
      where: { orgId, kind: "ISSUED", date: { gte: new Date(from), lte: new Date(to) } },
      select: { plate: true, driverName: true, permit: { select: { type: true } } },
    }),
  ]);
  const byDriver = new Map<string, { TIR: number; DAZVOL: number }>();
  for (const m of issued) {
    const k = m.driverName ?? "—";
    const v = byDriver.get(k) ?? { TIR: 0, DAZVOL: 0 };
    v[m.permit.type]++;
    byDriver.set(k, v);
  }
  return { moves, status, byDriver: [...byDriver.entries()].sort((a, b) => b[1].TIR + b[1].DAZVOL - (a[1].TIR + a[1].DAZVOL)) };
}
