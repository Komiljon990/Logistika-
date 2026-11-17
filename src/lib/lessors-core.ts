/** Haydovchi bilan hisob-kitob (sof): har valyuta bo'yicha hisoblangan, to'langan va qarz. */
export type LessorBalance = { charged: number; paid: number; debt: number };

/** Hisob turlari: ijarachi (a'zolik, soliq, TIR, dazvol, boshqa) va xodim haydovchi (reys uchun, qo'shimcha). */
export const CHARGE_TYPES = {
  LESSOR: ["MEMBERSHIP", "TAX", "TIR", "DAZVOL", "OTHER"],
  STAFF: ["TRIP", "BONUS", "OTHER"],
} as const satisfies Record<"LESSOR" | "STAFF", readonly string[]>;

export const LEDGER_TYPES = ["MEMBERSHIP", "TAX", "TIR", "DAZVOL", "TRIP", "BONUS", "OTHER"] as const;

const r2 = (n: number) => Math.round(n * 100) / 100;

export function lessorBalances(entries: { kind: "CHARGE" | "PAYMENT"; amount: number; currency: string }[]): Record<string, LessorBalance> {
  const out: Record<string, LessorBalance> = {};
  for (const e of entries) {
    const b = (out[e.currency] ??= { charged: 0, paid: 0, debt: 0 });
    if (e.kind === "CHARGE") b.charged = r2(b.charged + e.amount);
    else b.paid = r2(b.paid + e.amount);
    b.debt = r2(b.charged - b.paid);
  }
  return out;
}

/** Ko'chirma: sana tartibida har yozuvdan keyingi qarz (valyuta bo'yicha alohida). */
export function lessorStatement<E extends { kind: "CHARGE" | "PAYMENT"; amount: number; currency: string; date: Date; createdAt: Date }>(entries: E[]) {
  const running: Record<string, number> = {};
  return [...entries]
    .sort((a, b) => a.date.getTime() - b.date.getTime() || a.createdAt.getTime() - b.createdAt.getTime())
    .map((e) => {
      running[e.currency] = r2((running[e.currency] ?? 0) + (e.kind === "CHARGE" ? e.amount : -e.amount));
      return { ...e, debt: running[e.currency] };
    });
}

/** Oxirgi 12 oy va keyingi 2 oy ("2026-11") — a'zolik to'lovi oyi tanlovi uchun. */
export function monthOptions(today: string): string[] {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const out: string[] = [];
  for (let i = 2; i >= -12; i--) {
    const d = new Date(Date.UTC(y, m - 1 + i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}
