/**
 * Haydovchilar hisob-kitobi avtomatikasi va Telegram xabarlari (18.11.2026).
 * "server-only" import qilinmaydi: instrumentation.ts (oylik a'zolik) va bot ham ishlatadi.
 *
 * - Xodim haydovchi: tashish yakunlanganda (yuk tushirildi) kartochkasidagi "reys haqi" avtomatik hisob bo'ladi.
 * - Ijarachi: kartochkasida "oylik a'zolik" summasi bo'lsa — joriy oy uchun avtomatik hisoblanadi (bir oyga bir marta).
 * - Ijarachiga yangi hisob yoki to'lov haqida, xodimga reys haqi/to'lov haqida botga xabar (bot ulangan bo'lsa).
 */
import type { LedgerSide } from "@prisma/client";
import { db } from "./db";
import { audit } from "./audit";
import { formatNumber } from "./currency-core";
import { lessorBalances } from "./lessors-core";
import { botToken, tg } from "./telegram-bot";

const TYPE_UZ: Record<string, string> = {
  MEMBERSHIP: "A'zolik to'lovi", TAX: "Soliq", TIR: "TIR uchun", DAZVOL: "Dazvol uchun", TRIP: "Reys haqi", BONUS: "Qo'shimcha hisob", OTHER: "Boshqa",
};

/** Toshkent vaqti bo'yicha bugungi sana (UTC yarim tun) va oy ("2026-11"). */
export function tashkentDayDate(now: Date = new Date()): Date {
  const s = new Date(now.getTime() + 5 * 3_600_000).toISOString().slice(0, 10);
  return new Date(`${s}T00:00:00.000Z`);
}

export function tashkentMonth(now: Date = new Date()): string {
  return new Date(now.getTime() + 5 * 3_600_000).toISOString().slice(0, 7);
}

/** Haydovchining qarzi matn ko'rinishida (valyuta bo'yicha). */
export async function balanceLines(driverId: string, side: LedgerSide): Promise<string[]> {
  const entries = await db.driverEntry.findMany({ where: { driverId, side, status: "ACTIVE" }, select: { kind: true, amount: true, currency: true } });
  const bal = lessorBalances(entries.map((e) => ({ kind: e.kind, amount: Number(e.amount), currency: e.currency })));
  return Object.entries(bal).filter(([, b]) => Math.abs(b.debt) > 0.004).map(([cur, b]) => `${formatNumber(b.debt)} ${cur}`);
}

/** Botga oddiy xabar (bot yoki chat ulanmagan bo'lsa — jim o'tadi; xato asosiy amalni to'xtatmaydi). */
export async function notifyDriverText(driverId: string, text: string): Promise<void> {
  try {
    if (!botToken()) return;
    const d = await db.driver.findUnique({ where: { id: driverId }, select: { telegramChatId: true } });
    if (!d?.telegramChatId) return;
    await tg("sendMessage", { chat_id: d.telegramChatId, text });
  } catch (e) {
    console.error("Haydovchiga Telegram xabari yuborilmadi:", e instanceof Error ? e.message : e);
  }
}

/** Hisob/to'lov yozuvi haqida haydovchiga xabar. */
export async function notifyEntry(entryId: string): Promise<void> {
  try {
    if (!botToken()) return;
    const e = await db.driverEntry.findUnique({
      where: { id: entryId },
      include: { driver: { select: { id: true, telegramChatId: true, org: { select: { name: true } } } }, trip: { select: { number: true, routeFrom: true, routeTo: true } } },
    });
    if (!e?.driver.telegramChatId) return;
    const sum = `${formatNumber(Number(e.amount))} ${e.currency}`;
    const what = e.kind === "CHARGE"
      ? `${TYPE_UZ[e.type ?? "OTHER"]}${e.period ? ` (${e.period.slice(5, 7)}.${e.period.slice(0, 4)})` : ""}${e.trip ? ` — TSH-${String(e.trip.number).padStart(4, "0")} ${e.trip.routeFrom} → ${e.trip.routeTo}` : ""}`
      : "To'lov";
    const lines = await balanceLines(e.driver.id, e.side);
    const head = e.side === "LESSOR"
      ? e.kind === "CHARGE" ? `🧾 Hisobingizga yozildi: ${what} — ${sum}` : `✅ To'lovingiz qabul qilindi: ${sum}`
      : e.kind === "CHARGE" ? `🧾 Sizga hisoblandi: ${what} — ${sum}` : `💵 Sizga to'landi: ${sum}`;
    const tail = e.side === "LESSOR"
      ? lines.length ? `Joriy qarzingiz: ${lines.join(", ")}` : "Qarzingiz yo'q."
      : lines.length ? `Tashkilotning sizdan qarzi: ${lines.join(", ")}` : "Hisob-kitob yopilgan.";
    await tg("sendMessage", { chat_id: e.driver.telegramChatId, text: `${head}${e.note ? `\nIzoh: ${e.note}` : ""}\n${tail}\n${e.driver.org.name}` });
  } catch (err) {
    console.error("Hisob xabari yuborilmadi:", err instanceof Error ? err.message : err);
  }
}

/**
 * Tashish yakunlanganda: xodim haydovchiga reys haqi (kartochkasida belgilangan bo'lsa, shu reys uchun hali yozilmagan bo'lsa).
 * Qaytaradi: yaratilgan yozuv id yoki null.
 */
export async function autoTripCharge(tripId: string, actorId: string): Promise<string | null> {
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    include: { driver: { select: { id: true, category: true, tripRate: true, tripRateCurrency: true, status: true } }, events: { where: { type: "UNLOADED" }, select: { at: true } } },
  });
  const dr = trip?.driver;
  if (!trip || trip.status === "CANCELLED" || !dr || dr.category !== "EMPLOYEE" || !dr.tripRate || !dr.tripRateCurrency) return null;
  if (await db.driverEntry.findFirst({ where: { driverId: dr.id, side: "STAFF", type: "TRIP", tripId, status: "ACTIVE" } })) return null;
  const e = await db.driverEntry.create({
    data: {
      orgId: trip.orgId, driverId: dr.id, side: "STAFF", kind: "CHARGE", type: "TRIP", tripId, date: tashkentDayDate(trip.events[0]?.at ?? new Date()),
      amount: dr.tripRate, currency: dr.tripRateCurrency, note: "Avtomatik: reys haqi", createdById: actorId,
    },
  });
  await audit({ actorId: actorId === "system" ? null : actorId, orgId: trip.orgId, action: "ledger.auto_trip", entity: "DriverEntry", entityId: e.id, details: { tripId, amount: String(dr.tripRate), currency: dr.tripRateCurrency } }).catch(() => {});
  void notifyEntry(e.id);
  return e.id;
}

/**
 * Oylik a'zolik: kartochkasida summa belgilangan har faol ijarachiga joriy oy uchun (hali hisoblanmagan bo'lsa).
 * Sana — oyning 1-kuni. Qaytaradi: nechta yozuv yaratildi.
 */
export async function runAutoMembership(now: Date = new Date()): Promise<number> {
  const period = tashkentMonth(now);
  const date = new Date(`${period}-01T00:00:00.000Z`);
  const lessors = await db.driver.findMany({
    where: {
      status: "ACTIVE", category: "OWNER_OPERATOR", membershipFee: { not: null }, membershipCurrency: { not: null },
      org: { status: "ACTIVE", isDemo: false },
      entries: { none: { side: "LESSOR", type: "MEMBERSHIP", period, status: "ACTIVE" } },
    },
    select: { id: true, orgId: true, membershipFee: true, membershipCurrency: true },
  });
  let n = 0;
  for (const l of lessors) {
    // Bir vaqtda ikki jarayon ishlasa ham ikki marta yozilmasin: tashkilot qulfi bilan qayta tekshiramiz.
    const id = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${l.orgId}))::text`;
      if (await tx.driverEntry.findFirst({ where: { driverId: l.id, side: "LESSOR", type: "MEMBERSHIP", period, status: "ACTIVE" } })) return null;
      const e = await tx.driverEntry.create({
        data: {
          orgId: l.orgId, driverId: l.id, side: "LESSOR", kind: "CHARGE", type: "MEMBERSHIP", period, date,
          amount: l.membershipFee!, currency: l.membershipCurrency!, note: "Avtomatik: oylik a'zolik", createdById: "system",
        },
      });
      return e.id;
    });
    if (id) {
      n++;
      void notifyEntry(id);
    }
  }
  if (n) console.log(`[a'zolik] ${period}: ${n} ta ijarachiga hisoblandi`);
  return n;
}

const g = globalThis as unknown as { reysproLedgerTimer?: boolean };

/** Server ishga tushganda: darhol va har soatda oylik a'zolikni tekshiradi. */
export function startLedgerScheduler() {
  if (g.reysproLedgerTimer) return;
  g.reysproLedgerTimer = true;
  const run = () => runAutoMembership().catch((e) => console.error("[a'zolik] xato:", e instanceof Error ? e.message : e));
  setTimeout(run, 30_000);
  setInterval(run, 3_600_000);
}
