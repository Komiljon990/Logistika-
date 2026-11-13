/**
 * Hisob-kitob qoidalari (texnik shart 5-bo'lim + 13.11.2026 qarorlari), bazasiz va testlanadi.
 *
 * Yuk qismi qoldig'i = narx + qo'shimcha xarajatlar + prostoy − unga taqsimlangan to'lovlar (yuk valyutasida).
 * To'lovning taqsimlanmagan qismi — avans (to'lov valyutasida).
 * Mijoz qarzi (har valyuta alohida) = yuk qoldiqlari − avans.
 * Buxgalteriya narxi bu hisobga hech qachon kirmaydi.
 */

export type Terms = "CONTRACT" | "CASH";
export type Method = "BANK" | "CASH" | "CARD";
export type PayStatus = "UNPAID" | "PARTIAL" | "PAID";

const EPS = 0.005;

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Shartnoma — faqat bank; naqd kelishuv — naqd pul yoki karta. */
export function methodAllowed(method: Method, terms: Terms): boolean {
  return terms === "CONTRACT" ? method === "BANK" : method === "CASH" || method === "CARD";
}

export function shipmentTotals(price: number, charges: number[], applied: number[]) {
  const charged = round2(price + charges.reduce((s, x) => s + x, 0));
  const paid = round2(applied.reduce((s, x) => s + x, 0));
  return { charged, paid, remaining: round2(charged - paid) };
}

export function payStatus(charged: number, paid: number): PayStatus {
  if (paid <= EPS) return "UNPAID";
  if (paid + EPS >= charged) return "PAID";
  return "PARTIAL";
}

/** Prostoy summasi = kunlar × kunlik summa. */
export function demurrage(days: number, daily: number): number {
  return round2(days * daily);
}

/** Yuk valyutasida yopilgan summa uchun to'lov valyutasida qancha sarflanadi (rate: 1 yuk valyutasi = rate to'lov valyutasi). */
export function consumedFor(applied: number, rate: number): number {
  return round2(applied * rate);
}

export type OpenShipment = { id: string; currency: string; remaining: number; terms: Terms; order: number };
export type AllocationInput = { shipmentId: string; applied: number; rate: number };

export type AllocationCheck =
  | { ok: true; consumed: number[]; advance: number }
  | { ok: false; error: "pay.error.method" | "pay.error.over" | "pay.error.exceed" | "pay.error.rate" | "pay.error.amount" };

/**
 * Taqsimotni tekshiradi: har bir yuk shu to'lov turiga mos, qoldiqdan oshmaydi, kurs musbat,
 * jami sarflangan summa to'lov summasidan oshmaydi. Qolgani — avans.
 */
export function checkAllocations(amount: number, method: Method, allocations: AllocationInput[], open: Map<string, OpenShipment>): AllocationCheck {
  if (!(amount > 0)) return { ok: false, error: "pay.error.amount" };
  const consumed: number[] = [];
  for (const a of allocations) {
    const s = open.get(a.shipmentId);
    if (!s || !methodAllowed(method, s.terms)) return { ok: false, error: "pay.error.method" };
    if (!(a.rate > 0)) return { ok: false, error: "pay.error.rate" };
    if (!(a.applied > 0) || a.applied > s.remaining + EPS) return { ok: false, error: "pay.error.over" };
    consumed.push(consumedFor(a.applied, a.rate));
  }
  const total = round2(consumed.reduce((x, y) => x + y, 0));
  if (total > amount + EPS) return { ok: false, error: "pay.error.exceed" };
  return { ok: true, consumed, advance: round2(amount - total) };
}

/**
 * Avtomatik taqsimlash: eng eski qarzdan boshlab, to'lov summasi tugaguncha.
 * rateFor(valyuta) — 1 yuk valyutasi necha to'lov valyutasi; kurs yo'q bo'lsa o'sha yuk o'tkazib yuboriladi.
 */
export function autoAllocate(amount: number, method: Method, shipments: OpenShipment[], rateFor: (currency: string) => number | null): AllocationInput[] {
  let left = amount;
  const out: AllocationInput[] = [];
  for (const s of [...shipments].sort((a, b) => a.order - b.order)) {
    if (left <= EPS) break;
    if (!methodAllowed(method, s.terms) || s.remaining <= EPS) continue;
    const rate = rateFor(s.currency);
    if (!rate || rate <= 0) continue;
    // Pastga yaxlitlanadi: yopilgan summa hech qachon kelgan puldan oshmasin (qolgan tiyinlar avansga).
    const canCover = Math.floor((left / rate) * 100 + 1e-9) / 100;
    const applied = round2(Math.min(s.remaining, canCover));
    if (applied <= 0) continue;
    out.push({ shipmentId: s.id, applied, rate });
    left = round2(left - consumedFor(applied, rate));
  }
  return out;
}

export type CurrencyBalance = { charged: number; paid: number; advance: number; debt: number };

/** Mijoz balansi valyuta bo'yicha. */
export function clientBalance(
  shipments: { currency: string; charged: number; paid: number }[],
  payments: { currency: string; advance: number }[],
): Record<string, CurrencyBalance> {
  const out: Record<string, CurrencyBalance> = {};
  const get = (c: string) => (out[c] ??= { charged: 0, paid: 0, advance: 0, debt: 0 });
  for (const s of shipments) {
    const b = get(s.currency);
    b.charged = round2(b.charged + s.charged);
    b.paid = round2(b.paid + s.paid);
  }
  for (const p of payments) {
    if (p.advance <= EPS) continue;
    const b = get(p.currency);
    b.advance = round2(b.advance + p.advance);
  }
  for (const b of Object.values(out)) b.debt = round2(b.charged - b.paid - b.advance);
  return out;
}
