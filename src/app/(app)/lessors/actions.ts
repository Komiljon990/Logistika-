"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { LedgerKind, LedgerSide, LedgerType } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireSection } from "@/lib/session";
import { orgForWrite, ForbiddenError } from "@/lib/scope";
import { parseDate } from "@/lib/dates";
import { parseAmount } from "@/lib/currency-core";
import { activeCurrencies } from "@/lib/org-currency";
import { normalizePhone } from "@/lib/phone";
import { tashkentToday } from "@/lib/docs";
import { cashEnabled } from "@/lib/cash";
import { CHARGE_TYPES } from "@/lib/lessors-core";
import { fail, optStr, str, type FormState } from "@/lib/form";
import { notifyEntry, runAutoMembership } from "@/lib/driver-ledger";
import { notifyIncome } from "@/lib/telegram-staff";

/**
 * Haydovchilar bilan hisob-kitob (17.11.2026).
 * LESSOR — ijarachilar (o'z transportidagi haydovchilar), "Ijarachilar" bo'limi;
 * STAFF — xodim haydovchilar, "Hisob-kitob → Haydovchilar" bo'limi.
 */
async function editor(side: LedgerSide) {
  const user = await requireSection(side === "LESSOR" ? "lessors" : "settlements", "EDIT");
  return { user, orgId: orgForWrite(user) };
}

const today = () => tashkentToday().toISOString().slice(0, 10);
const base = (side: LedgerSide) => (side === "LESSOR" ? "/lessors" : "/settlements/drivers");

function revalidate(side: LedgerSide, driverId: string) {
  revalidatePath(`${base(side)}/${driverId}`);
  revalidatePath(base(side));
  revalidatePath(`/drivers/${driverId}`);
  revalidatePath("/cash", "layout");
}

/** Yangi ijarachi = "o'z transportida" toifali haydovchi (Haydovchilar bo'limida ham ko'rinadi). */
export async function createLessor(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await editor("LESSOR");
  const fullName = str(formData, "fullName").slice(0, 200);
  if (!fullName) return fail("common.required", formData);
  const raw = str(formData, "phone");
  const phone = raw ? normalizePhone(raw) : null;
  if (raw && !phone) return fail("user.error.phone", formData);
  const d = await db.driver.create({ data: { orgId, fullName, phone, category: "OWNER_OPERATOR", note: optStr(formData, "note", 300) } });
  await audit({ actorId: user.id, orgId, action: "driver.create", entity: "Driver", entityId: d.id, details: { fullName, category: "OWNER_OPERATOR" } });
  redirect(`/lessors/${d.id}`);
}

/** Ijarachiga transport biriktirish (transport "ijarachi transporti" bo'ladi). */
export async function attachVehicle(driverId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await editor("LESSOR");
  const driver = await db.driver.findFirst({ where: { id: driverId, orgId, category: "OWNER_OPERATOR" } });
  const vehicle = await db.vehicle.findFirst({ where: { id: str(formData, "vehicleId"), orgId, } });
  if (!driver) throw new ForbiddenError();
  if (!vehicle) return fail("lessor.error.vehicle", formData);
  await db.vehicle.update({ where: { id: vehicle.id }, data: { ownerDriverId: driverId, ownership: "LEASED", leaseOwner: driver.fullName } });
  await audit({ actorId: user.id, orgId, action: "lessor.vehicle", entity: "Vehicle", entityId: vehicle.id, details: { driverId, plate: vehicle.plate } });
  revalidatePath(`/lessors/${driverId}`);
  revalidatePath("/lessors");
  revalidatePath(`/vehicles/${vehicle.id}`);
  return { ok: true };
}

export async function detachVehicle(vehicleId: string): Promise<FormState> {
  const { user, orgId } = await editor("LESSOR");
  const v = await db.vehicle.findFirst({ where: { id: vehicleId, orgId, ownerDriverId: { not: null } } });
  if (!v) throw new ForbiddenError();
  await db.vehicle.update({ where: { id: v.id }, data: { ownerDriverId: null } });
  await audit({ actorId: user.id, orgId, action: "lessor.vehicle_detach", entity: "Vehicle", entityId: v.id, details: { driverId: v.ownerDriverId, plate: v.plate } });
  revalidatePath(`/lessors/${v.ownerDriverId}`);
  revalidatePath("/lessors");
  return { ok: true };
}

/**
 * Hisob qo'shish yoki to'lov.
 * Ijarachi: hisob — a'zolik to'lovi (oy), soliq, TIR, dazvol, boshqa; to'lov — tanlangan hisobga kirim.
 * Xodim haydovchi: hisob — bajargan reysi uchun yoki qo'shimcha; to'lov — tanlangan hisobdan chiqim.
 * Kassa yoqilgan va hisob ochilgan bo'lsa — to'lovda hisob majburiy, valyuta shu hisobniki.
 */
export async function addDriverEntry(driverId: string, side: LedgerSide, kind: LedgerKind, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await editor(side);
  if (kind !== "CHARGE" && kind !== "PAYMENT") throw new ForbiddenError();
  if (side !== "LESSOR" && side !== "STAFF") throw new ForbiddenError();
  const driver = await db.driver.findFirst({ where: { id: driverId, orgId, } });
  if (!driver) throw new ForbiddenError();
  const date = parseDate(formData.get("date"));
  if (!date || date.toISOString().slice(0, 10) > today()) return fail("pay.error.date", formData);
  const amount = parseAmount(str(formData, "amount"));
  if (amount === null || amount <= 0 || amount > 1e13) return fail("pay.error.amount", formData);
  let currency = str(formData, "currency");
  let accountId: string | null = null;
  let type: LedgerType | null = null;
  let period: string | null = null;
  let tripId: string | null = null;
  if (kind === "CHARGE") {
    type = str(formData, "type") as LedgerType;
    if (!(CHARGE_TYPES[side] as readonly string[]).includes(type)) return fail("lessor.error.type", formData);
    if (type === "MEMBERSHIP") {
      period = str(formData, "period");
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return fail("lessor.error.period", formData);
      // Bir oy uchun a'zolik to'lovi ikki marta hisoblanmasin.
      if (await db.driverEntry.findFirst({ where: { driverId, side, type: "MEMBERSHIP", period, status: "ACTIVE" } })) return fail("lessor.error.dupMonth", formData);
    }
    if (type === "TRIP") {
      const trip = await db.trip.findFirst({ where: { id: str(formData, "tripId"), orgId, driverId, status: { not: "CANCELLED" } } });
      if (!trip) return fail("lessor.error.trip", formData);
      // Bitta reys bir marta hisoblanadi; qo'shimcha summa — "Qo'shimcha hisob" orqali.
      if (await db.driverEntry.findFirst({ where: { driverId, side, type: "TRIP", tripId: trip.id, status: "ACTIVE" } })) return fail("ledger.error.tripCharged", formData);
      tripId = trip.id;
    }
  } else if ((await cashEnabled(orgId)) && (await db.cashAccount.count({ where: { orgId, status: "ACTIVE" } })) > 0) {
    const account = await db.cashAccount.findFirst({ where: { id: str(formData, "accountId"), orgId, status: "ACTIVE" } });
    if (!account) return fail("cash.error.account", formData);
    accountId = account.id;
    currency = account.currency;
  }
  if (!(await activeCurrencies(orgId)).includes(currency)) return fail("trip.error.currency", formData);
  let vehicle: { id: string; plate: string } | null = null;
  const vehicleId = str(formData, "vehicleId");
  if (vehicleId) {
    vehicle = await db.vehicle.findFirst({ where: { id: vehicleId, orgId }, select: { id: true, plate: true } });
    if (!vehicle) throw new ForbiddenError();
  }
  const e = await db.driverEntry.create({
    data: {
      orgId, driverId, side, kind, type, period, tripId, date, amount, currency, accountId,
      vehicleId: vehicle?.id ?? null, plate: vehicle?.plate ?? null, note: optStr(formData, "note", 300), createdById: user.id,
    },
  });
  await audit({
    actorId: user.id, orgId, action: kind === "CHARGE" ? "ledger.charge" : "ledger.payment", entity: "DriverEntry", entityId: e.id,
    details: { driverId, side, type, period, tripId, amount, currency, accountId },
  });
  // Haydovchiga botda xabar (ulangan bo'lsa): yangi hisob yoki to'lov va joriy qarz.
  void notifyEntry(e.id);
  // Ijarachidan to'lov — rahbar va buxgalterga xabar (19.11.2026).
  if (side === "LESSOR" && kind === "PAYMENT") void notifyIncome("lessor", e.id, user.id);
  revalidate(side, driverId);
  return { ok: true };
}

/**
 * Avtomatik hisob sozlamasi (18.11.2026).
 * Ijarachi — oylik a'zolik summasi: har oy (joriy oydan boshlab) avtomatik hisoblanadi.
 * Xodim haydovchi — reys haqi: tashish yakunlanganda (yuk tushirilganda) avtomatik hisoblanadi.
 * Summa bo'sh — avtomatik hisob o'chiriladi.
 */
export async function setDriverRate(driverId: string, side: LedgerSide, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await editor(side);
  if (side !== "LESSOR" && side !== "STAFF") throw new ForbiddenError();
  const driver = await db.driver.findFirst({ where: { id: driverId, orgId } });
  if (!driver) throw new ForbiddenError();
  const raw = str(formData, "amount");
  let amount: number | null = null;
  let currency: string | null = null;
  if (raw) {
    amount = parseAmount(raw);
    if (amount === null || amount <= 0 || amount > 1e13) return fail("pay.error.amount", formData);
    currency = str(formData, "currency");
    if (!(await activeCurrencies(orgId)).includes(currency)) return fail("trip.error.currency", formData);
  }
  await db.driver.update({
    where: { id: driverId },
    data: side === "LESSOR" ? { membershipFee: amount, membershipCurrency: currency } : { tripRate: amount, tripRateCurrency: currency },
  });
  await audit({ actorId: user.id, orgId, action: "ledger.rate", entity: "Driver", entityId: driverId, details: { side, amount, currency } });
  // Ijarachi: joriy oy hali hisoblanmagan bo'lsa — darhol.
  if (side === "LESSOR" && amount) await runAutoMembership();
  revalidate(side, driverId);
  return { ok: true };
}

/**
 * Oylik a'zolik to'lovini barcha faol ijarachilarga birdaniga hisoblash: shu oy uchun hali hisoblanmaganlarga.
 * Natija: nechta ijarachiga hisoblandi ("ok" xabarida soni).
 */
export async function bulkMembership(_prev: FormState & { count?: number }, formData: FormData): Promise<FormState & { count?: number }> {
  const { user, orgId } = await editor("LESSOR");
  const period = str(formData, "period");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return fail("lessor.error.period", formData);
  const amount = parseAmount(str(formData, "amount"));
  if (amount === null || amount <= 0 || amount > 1e13) return fail("pay.error.amount", formData);
  const currency = str(formData, "currency");
  if (!(await activeCurrencies(orgId)).includes(currency)) return fail("trip.error.currency", formData);
  const date = new Date(`${today()}T00:00:00.000Z`);
  const lessors = await db.driver.findMany({
    where: { orgId, status: "ACTIVE", category: "OWNER_OPERATOR", entries: { none: { side: "LESSOR", type: "MEMBERSHIP", period, status: "ACTIVE" } } },
    select: { id: true },
  });
  if (!lessors.length) return { ok: true, count: 0 };
  await db.driverEntry.createMany({
    data: lessors.map((l) => ({
      orgId, driverId: l.id, side: "LESSOR" as const, kind: "CHARGE" as const, type: "MEMBERSHIP" as const, period, date, amount, currency,
      note: optStr(formData, "note", 300), createdById: user.id,
    })),
  });
  await audit({ actorId: user.id, orgId, action: "ledger.bulk", entity: "DriverEntry", entityId: period, details: { period, amount, currency, count: lessors.length } });
  const created = await db.driverEntry.findMany({ where: { orgId, side: "LESSOR", type: "MEMBERSHIP", period, status: "ACTIVE", driverId: { in: lessors.map((l) => l.id) } }, select: { id: true } });
  for (const c of created) void notifyEntry(c.id);
  revalidatePath("/lessors", "layout");
  return { ok: true, count: lessors.length };
}

/** Yozuvni bekor qilish (o'chirilmaydi): qarz va kassa qoldig'i qaytadi, tarix saqlanadi. */
export async function cancelDriverEntry(id: string): Promise<FormState> {
  const e = await db.driverEntry.findFirst({ where: { id, status: "ACTIVE" } });
  if (!e) throw new ForbiddenError();
  const { user, orgId } = await editor(e.side);
  if (e.orgId !== orgId) throw new ForbiddenError();
  await db.driverEntry.update({ where: { id }, data: { status: "ARCHIVED" } });
  await audit({ actorId: user.id, orgId, action: "ledger.cancel", entity: "DriverEntry", entityId: id });
  revalidate(e.side, e.driverId);
  return { ok: true };
}
