/** Kassa hisob-kitoblari (bazasiz, testlanadi): hisob turi, qoldiq va aylanma, o'tkazma kursi. */
import { BASE, addDays, parseDay, type RateMap } from "./currency-core";

export type AccountKind = "BANK" | "CASH" | "CARD";
export const ACCOUNT_KINDS: readonly AccountKind[] = ["BANK", "CASH", "CARD"];

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * To'lov qaysi turdagi hisobga tushadi: bank → bank hisob raqami, karta → karta, naqd (ofis) → naqd kassa.
 * Haydovchi olgan naqd pul hali hisobga tushmagan (topshirilganda kassa tanlanadi) — null.
 */
export function accountKindFor(method: "BANK" | "CASH" | "CARD", receivedBy: "OFFICE" | "DRIVER" | null): AccountKind | null {
  if (method === "BANK") return "BANK";
  if (method === "CARD") return "CARD";
  return receivedBy === "DRIVER" ? null : "CASH";
}

/** Hisob bo'yicha bitta harakat: kirim (+) yoki chiqim (−), hisob valyutasida. */
export type Movement = {
  accountId: string;
  day: string; // YYYY-MM-DD (Toshkent)
  amount: number; // + kirim, − chiqim
};

export type AccountTurnover = { opening: number; income: number; expense: number; closing: number };

/**
 * Davr aylanmasi: davr boshidagi qoldiq (boshlang'ich qoldiq + davrdan oldingi harakatlar),
 * davr ichidagi kirim va chiqim, davr oxiridagi qoldiq. `from`/`to` — kiritilgan kunlar ham hisobga olinadi.
 */
export function turnover(openingBalance: number, movements: Movement[], from: string, to: string): AccountTurnover {
  let opening = openingBalance;
  let income = 0;
  let expense = 0;
  for (const m of movements) {
    if (m.day < from) opening += m.amount;
    else if (m.day <= to) {
      if (m.amount >= 0) income += m.amount;
      else expense -= m.amount;
    }
  }
  opening = round2(opening);
  income = round2(income);
  expense = round2(expense);
  return { opening, income, expense, closing: round2(opening + income - expense) };
}

/**
 * Hisob ko'chirmasi (bank ko'chirmasi kabi): davr boshidagi qoldiq, davr ichidagi har bir harakat vaqt tartibida
 * va undan keyingi qoldiq, jami kirim/chiqim va davr oxiridagi qoldiq.
 */
export function statement<M extends Movement & { at?: number }>(openingBalance: number, movements: M[], from: string, to: string) {
  const tv = turnover(openingBalance, movements, from, to);
  const inPeriod = movements
    .filter((m) => m.day >= from && m.day <= to)
    .sort((a, b) => (a.day === b.day ? (a.at ?? 0) - (b.at ?? 0) : a.day < b.day ? -1 : 1));
  let running = tv.opening;
  const rows = inPeriod.map((m) => {
    running = round2(running + m.amount);
    return { ...m, balance: running };
  });
  return { ...tv, rows };
}

/** Joriy qoldiq: boshlang'ich qoldiq + barcha harakatlar. */
export function balance(openingBalance: number, movements: Movement[]): number {
  return round2(movements.reduce((s, m) => s + m.amount, openingBalance));
}

/**
 * Hisobot davri: ?month=YYYY-MM yoki ?from=…&to=… (ikkalasi ham bo'lsa — from/to ustun).
 * Noto'g'ri yoki bo'sh bo'lsa — joriy oy. Davr 2 yildan oshmaydi, from > to bo'lsa almashtiriladi.
 */
export function parsePeriod(today: string, p: { month?: string; from?: string; to?: string }): { from: string; to: string; month: string | null } {
  let from = parseDay(p.from);
  let to = parseDay(p.to);
  if (from || to) {
    from ??= to!;
    to ??= from;
    if (from > to) [from, to] = [to, from];
    if (from < addDays(to, -731)) from = addDays(to, -731);
    return { from, to, month: null };
  }
  const month = p.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(p.month) ? p.month : today.slice(0, 7);
  return { from: `${month}-01`, to: monthEnd(month), month };
}

export function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/**
 * O'tkazma kursi qaysi valyutada ifodalanadi: qimmatroq valyuta asos (1 USD = 12 650 UZS, 1 USD = 0,92 EUR emas,
 * 1 EUR = 1,08 USD). Kurs ma'lum bo'lmasa — so'm bo'lmagan valyuta, aks holda `from`.
 */
export function rateBaseFor(rates: RateMap, from: string, to: string): string {
  const a = from === BASE ? 1 : rates[from];
  const b = to === BASE ? 1 : rates[to];
  if (a && b) return a >= b ? from : to;
  return from === BASE ? to : from;
}

/** O'tkazmada tushadigan summa: kurs "1 base = rate boshqa valyuta" ko'rinishida. */
export function convertTransfer(amount: number, from: string, to: string, rate: number, base: string): number {
  if (from === to) return round2(amount);
  return round2(base === from ? amount * rate : amount / rate);
}

/** MB kursi bo'yicha "1 base = ? boshqa" (asos tanlangandan keyin). */
export function cbuTransferRate(rates: RateMap, from: string, to: string, base: string): number | null {
  const other = base === from ? to : from;
  const a = base === BASE ? 1 : rates[base];
  const b = other === BASE ? 1 : rates[other];
  return a && b ? a / b : null;
}

/** Karta raqami: faqat raqamlar, 16 (ba'zan 13–19) xona; ko'rsatish uchun 4 tadan guruhlanadi. */
export function normalizeCard(s: string): string | null {
  const digits = s.replace(/[\s-]/g, "");
  return /^\d{13,19}$/.test(digits) ? digits : null;
}

export function formatCard(digits: string): string {
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

/** Bank hisob raqami (O'zbekiston: 20 xona) va MFO (5 xona). */
export function normalizeAccountNumber(s: string): string | null {
  const digits = s.replace(/[\s-]/g, "");
  return /^\d{20}$/.test(digits) ? digits : null;
}

export function normalizeMfo(s: string): string | null {
  const digits = s.replace(/\s/g, "");
  return /^\d{5}$/.test(digits) ? digits : null;
}

/** Hisob nomi ro'yxatlarda: "Kapitalbank · 2020 8000 … · USD". */
export function accountLabel(a: { kind: AccountKind; name: string; accountNumber?: string | null; cardNumber?: string | null; cardHolder?: string | null; currency: string }): string {
  const parts = [a.name];
  if (a.kind === "BANK" && a.accountNumber) parts.push(`…${a.accountNumber.slice(-4)}`);
  if (a.kind === "CARD" && a.cardNumber) parts.push(`*${a.cardNumber.slice(-4)}${a.cardHolder ? ` (${a.cardHolder})` : ""}`);
  parts.push(a.currency);
  return parts.join(" · ");
}
