"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma, TripEventType } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireSection } from "@/lib/session";
import { orgForWrite, orgScope, ForbiddenError } from "@/lib/scope";
import { parseDate } from "@/lib/dates";
import { parseAmount } from "@/lib/currency-core";
import { activeCurrencies } from "@/lib/org-currency";
import { fail, optStr, str, type FormState } from "@/lib/form";
import { EVENT_ORDER, checkEvent, completesTrip, normalizeContactPhone, parseTashkentDateTime } from "@/lib/trips-core";
import { busyDriverIds, doneEvents, loadedVehicleIds, lockOrg } from "@/lib/trips";
import { formatPlace } from "@/lib/places-core";
import { autoTripCharge } from "@/lib/driver-ledger";
import { notifyNewTrip } from "@/lib/telegram-bot";
import type { Dict } from "@/i18n";
import { BILLABLE_CHARGES } from "@/lib/charges";

/** Tashish, yuk va holatlarni menejer kiritadi; tashkilot sessiyadan olinadi. */
async function editor() {
  const user = await requireSection("trips", "EDIT");
  return { user, orgId: orgForWrite(user) };
}

type Tx = Prisma.TransactionClient;

type ShipmentData = Omit<Prisma.ShipmentUncheckedCreateInput, "tripId" | "orgId" | "createdById" | "clientId">;

/**
 * Yuk qismi maydonlari (yangi tashish, qo'shimcha yuk va tahrirlash uchun bir xil).
 * "Faqat ro'yxat" tashishida narx, kelishuv va mas'ul shaxs majburiy emas (narx 0 deb saqlanadi).
 */
async function shipmentInput(formData: FormData, orgId: string, listOnly = false): Promise<{ data: ShipmentData } | { error: keyof Dict }> {
  if (listOnly) {
    const currencies = await activeCurrencies(orgId);
    const rawPhone = str(formData, "contactPhone");
    const phone = rawPhone ? normalizeContactPhone(rawPhone) : "";
    if (phone === null) return { error: "trip.error.contactPhone" };
    return {
      data: {
        contactName: str(formData, "contactName").slice(0, 200), contactPhone: phone, terms: "CONTRACT", price: 0,
        currency: currencies.includes(str(formData, "currency")) ? str(formData, "currency") : (currencies[0] ?? "UZS"),
        accountingPrice: null, accountingCurrency: null,
        cargo: optStr(formData, "cargo", 300), smrNumber: optStr(formData, "smrNumber", 50),
      },
    };
  }
  const contactName = str(formData, "contactName").slice(0, 200);
  const contactPhone = normalizeContactPhone(str(formData, "contactPhone"));
  const terms = str(formData, "terms");
  const price = parseAmount(str(formData, "price"));
  const currency = str(formData, "currency");
  const accRaw = str(formData, "accountingPrice");
  const accountingPrice = accRaw ? parseAmount(accRaw) : null;
  const accountingCurrency = accRaw ? str(formData, "accountingCurrency") || "UZS" : null;
  if (!contactName) return { error: "trip.error.contact" };
  if (!contactPhone) return { error: "trip.error.contactPhone" };
  if (terms !== "CONTRACT" && terms !== "CASH") return { error: "common.required" };
  if (price === null || price <= 0 || price > 1e12) return { error: "trip.error.price" };
  if (accRaw && (accountingPrice === null || accountingPrice < 0 || accountingPrice > 1e14)) return { error: "trip.error.price" };
  const currencies = await activeCurrencies(orgId);
  if (!currencies.includes(currency) || (accountingCurrency && !currencies.includes(accountingCurrency))) return { error: "trip.error.currency" };
  return {
    data: {
      contactName, contactPhone, terms, price, currency, accountingPrice, accountingCurrency,
      cargo: optStr(formData, "cargo", 300),
      smrNumber: optStr(formData, "smrNumber", 50),
    },
  };
}

/** Mavjud mijoz (o'z tashkilotida, faol) yoki shu yerning o'zida yangi mijoz. */
async function resolveClient(tx: Tx, formData: FormData, orgId: string): Promise<{ id: string; created: boolean } | null> {
  const clientId = str(formData, "clientId");
  if (clientId && clientId !== "new") {
    const c = await tx.client.findFirst({ where: { id: clientId, orgId, status: "ACTIVE" } });
    return c ? { id: c.id, created: false } : null;
  }
  const name = str(formData, "newClientName").slice(0, 200);
  if (!name) return null;
  const c = await tx.client.create({ data: { orgId, name, inn: optStr(formData, "newClientInn", 20) } });
  return { id: c.id, created: true };
}

class FormError extends Error {
  constructor(public key: keyof Dict) { super(key); }
}

export async function createTrip(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await editor();
  const routeFrom = formatPlace(str(formData, "routeFrom")).slice(0, 200);
  const routeTo = formatPlace(str(formData, "routeTo")).slice(0, 200);
  const loadDate = parseDate(formData.get("loadDate"));
  if (!routeFrom || !routeTo || !loadDate) return fail("common.required", formData);
  const listOnly = formData.get("listOnly") === "on";
  const ship = await shipmentInput(formData, orgId, listOnly);
  if ("error" in ship) return fail(ship.error, formData);

  let tripId: string;
  let newClient: string | null = null;
  try {
    tripId = await db.$transaction(async (tx) => {
      await lockOrg(tx, orgId);
      const busy = await loadedVehicleIds(orgId, tx);
      const tractor = await tx.vehicle.findFirst({ where: { id: str(formData, "tractorId"), orgId, type: "TRACTOR", status: "ACTIVE" } });
      if (!tractor) throw new FormError("trip.error.tractor");
      if (busy.has(tractor.id)) throw new FormError("trip.error.busy");
      const trailerId = str(formData, "trailerId");
      if (trailerId) {
        const tr = await tx.vehicle.findFirst({ where: { id: trailerId, orgId, type: "TRAILER", status: "ACTIVE" } });
        if (!tr) throw new ForbiddenError();
        if (busy.has(tr.id)) throw new FormError("trip.error.busy");
      }
      const driver = await tx.driver.findFirst({ where: { id: str(formData, "driverId"), orgId, status: "ACTIVE" } });
      if (!driver) throw new FormError("trip.error.driver");
      if ((await busyDriverIds(orgId, tx)).has(driver.id)) throw new FormError("trip.error.driverBusy");
      const client = await resolveClient(tx, formData, orgId);
      if (!client) throw new FormError("trip.error.client");
      if (client.created) newClient = client.id;
      const clientId = client.id;
      const last = await tx.trip.aggregate({ where: { orgId }, _max: { number: true } });
      const trip = await tx.trip.create({
        data: {
          orgId, number: (last._max.number ?? 0) + 1, routeFrom, routeTo, loadDate,
          tractorId: tractor.id, trailerId: trailerId || null, driverId: driver.id,
          cargo: optStr(formData, "cargo", 300), listOnly, createdById: user.id,
        },
      });
      await tx.shipment.create({ data: { ...ship.data, orgId, tripId: trip.id, clientId, createdById: user.id } });
      return trip.id;
    });
  } catch (e) {
    if (e instanceof FormError) return fail(e.key, formData);
    throw e;
  }
  if (newClient) await audit({ actorId: user.id, orgId, action: "client.create", entity: "Client", entityId: newClient, details: { via: "trip", tripId } });
  await audit({
    actorId: user.id, orgId, action: "trip.create", entity: "Trip", entityId: tripId,
    details: { routeFrom, routeTo, price: String(ship.data.price), currency: ship.data.currency },
  });
  // Haydovchiga botda: yangi reys va "Qabul qildim" tugmasi (bot ulangan bo'lsa).
  await notifyNewTrip(tripId);
  redirect(`/trips/${tripId}`);
}

/** Qo'shimcha yuk: mavjud (yuki hali tushirilmagan) tashishga yangi mijoz va yuk qismi. */
export async function addShipment(tripId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await editor();
  const tripRow = await db.trip.findFirst({ where: { id: tripId, orgId }, select: { listOnly: true } });
  if (!tripRow) throw new ForbiddenError();
  const ship = await shipmentInput(formData, orgId, tripRow.listOnly);
  if ("error" in ship) return fail(ship.error, formData);
  let created: { shipmentId: string; newClient: string | null };
  try {
    created = await db.$transaction(async (tx) => {
      await lockOrg(tx, orgId);
      const trip = await tx.trip.findFirst({ where: { id: tripId, orgId } });
      if (!trip) throw new ForbiddenError();
      if (trip.status !== "ACTIVE" || (await doneEvents(tx, tripId)).UNLOADED) throw new FormError("trip.error.closed");
      const client = await resolveClient(tx, formData, orgId);
      if (!client) throw new FormError("trip.error.client");
      const s = await tx.shipment.create({ data: { ...ship.data, orgId, tripId, clientId: client.id, createdById: user.id } });
      return { shipmentId: s.id, newClient: client.created ? client.id : null };
    });
  } catch (e) {
    if (e instanceof FormError) return fail(e.key, formData);
    throw e;
  }
  if (created.newClient) await audit({ actorId: user.id, orgId, action: "client.create", entity: "Client", entityId: created.newClient, details: { via: "trip", tripId } });
  await audit({
    actorId: user.id, orgId, action: "shipment.create", entity: "Shipment", entityId: created.shipmentId,
    details: { tripId, price: String(ship.data.price), currency: ship.data.currency },
  });
  revalidatePath(`/trips/${tripId}`);
  return { ok: true };
}

/**
 * Tashishni tahrirlash (17.11.2026): yo'nalish, sana, izoh, transport va haydovchi, "faqat ro'yxat" belgisi.
 * Transport almashtirilsa — u boshqa yukli tashishda band bo'lmasligi kerak. Hisob-kitobli tashishni
 * "faqat ro'yxat"ga o'tkazish uchun unda to'lov va qo'shimcha xarajat bo'lmasligi kerak.
 */
export async function updateTrip(tripId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await editor();
  const routeFrom = formatPlace(str(formData, "routeFrom")).slice(0, 200);
  const routeTo = formatPlace(str(formData, "routeTo")).slice(0, 200);
  const loadDate = parseDate(formData.get("loadDate"));
  if (!routeFrom || !routeTo || !loadDate) return fail("common.required", formData);
  const listOnly = formData.get("listOnly") === "on";
  let before: Record<string, unknown> = {};
  try {
    await db.$transaction(async (tx) => {
      await lockOrg(tx, orgId);
      const trip = await tx.trip.findFirst({
        where: { id: tripId, orgId },
        include: { shipments: { where: { status: "ACTIVE" }, include: { _count: { select: { allocations: true, charges: { where: { status: "ACTIVE" } } } } } } },
      });
      if (!trip) throw new ForbiddenError();
      if (trip.status === "CANCELLED") throw new FormError("trip.error.closed");
      before = { routeFrom: trip.routeFrom, routeTo: trip.routeTo, loadDate: trip.loadDate.toISOString().slice(0, 10), tractorId: trip.tractorId, trailerId: trip.trailerId, driverId: trip.driverId, listOnly: trip.listOnly };
      if (listOnly && !trip.listOnly && trip.shipments.some((s) => s._count.allocations + s._count.charges > 0)) throw new FormError("trip.error.listOnlyHasMoney");
      if (!listOnly && trip.listOnly && trip.shipments.some((s) => Number(s.price) <= 0)) throw new FormError("trip.error.needPrices");
      const tractorId = str(formData, "tractorId") || trip.tractorId;
      const trailerId = str(formData, "trailerId") || null;
      const driverId = str(formData, "driverId") || trip.driverId;
      const busy = trip.status === "ACTIVE" ? await loadedVehicleIds(orgId, tx) : new Set<string>();
      if (tractorId !== trip.tractorId) {
        const tr = await tx.vehicle.findFirst({ where: { id: tractorId, orgId, type: "TRACTOR", status: "ACTIVE" } });
        if (!tr) throw new FormError("trip.error.tractor");
        if (busy.has(tr.id)) throw new FormError("trip.error.busy");
      }
      if (trailerId && trailerId !== trip.trailerId) {
        const tl = await tx.vehicle.findFirst({ where: { id: trailerId, orgId, type: "TRAILER", status: "ACTIVE" } });
        if (!tl) throw new ForbiddenError();
        if (busy.has(tl.id)) throw new FormError("trip.error.busy");
      }
      if (driverId !== trip.driverId) {
        if (!(await tx.driver.findFirst({ where: { id: driverId, orgId, status: "ACTIVE" } }))) throw new FormError("trip.error.driver");
        if (trip.status === "ACTIVE" && (await busyDriverIds(orgId, tx, trip.id)).has(driverId)) throw new FormError("trip.error.driverBusy");
      }
      await tx.trip.update({
        where: { id: tripId },
        data: { routeFrom, routeTo, loadDate, tractorId, trailerId, driverId, listOnly, cargo: optStr(formData, "cargo", 300), note: optStr(formData, "note", 500) },
      });
    });
  } catch (e) {
    if (e instanceof FormError) return fail(e.key, formData);
    throw e;
  }
  await audit({
    actorId: user.id, orgId, action: "trip.update", entity: "Trip", entityId: tripId,
    details: { from: before as Prisma.InputJsonValue, to: { routeFrom, routeTo, loadDate: loadDate.toISOString().slice(0, 10), listOnly } },
  });
  // Haydovchi almashtirilgan bo'lsa — yangi haydovchiga botda xabar.
  const newDriver = str(formData, "driverId");
  if (newDriver && newDriver !== before.driverId) await notifyNewTrip(tripId);
  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/trips");
  return { ok: true };
}

/**
 * Yuk qismini tahrirlash: mijoz, mas'ul shaxs, yuk, CMR, shartnoma turi, narx, valyuta.
 * To'lov taqsimlangan yuk qismida mijoz, valyuta va shartnoma turi o'zgarmaydi (hisob buzilmasligi uchun);
 * narx esa to'langan summadan kam bo'lishi mumkin emas.
 */
export async function updateShipment(shipmentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await editor();
  const s = await db.shipment.findFirst({
    where: { id: shipmentId, orgId, status: "ACTIVE" },
    include: {
      trip: { select: { id: true, status: true, listOnly: true } },
      charges: { where: BILLABLE_CHARGES, select: { amount: true } },
      allocations: { where: { payment: { status: "ACTIVE" } }, select: { applied: true } },
    },
  });
  if (!s) throw new ForbiddenError();
  if (s.trip.status === "CANCELLED") return fail("trip.error.closed", formData);
  const ship = await shipmentInput(formData, orgId, s.trip.listOnly);
  if ("error" in ship) return fail(ship.error, formData);
  const clientId = str(formData, "clientId");
  const client = clientId ? await db.client.findFirst({ where: { id: clientId, orgId, status: "ACTIVE" } }) : null;
  if (!client) return fail("trip.error.client", formData);
  const paid = s.allocations.reduce((a, x) => a + Number(x.applied), 0);
  if (paid > 0 && (client.id !== s.clientId || ship.data.currency !== s.currency || ship.data.terms !== s.terms)) return fail("trip.error.lockedPaid", formData);
  const charges = s.charges.reduce((a, x) => a + Number(x.amount), 0);
  if (Number(ship.data.price) + charges + 0.005 < paid) return fail("trip.error.priceBelowPaid", formData);
  await db.shipment.update({ where: { id: shipmentId }, data: { ...ship.data, clientId: client.id } });
  await audit({
    actorId: user.id, orgId, action: "shipment.update", entity: "Shipment", entityId: shipmentId,
    details: {
      tripId: s.trip.id,
      from: { clientId: s.clientId, terms: s.terms, price: String(s.price), currency: s.currency },
      to: { clientId: client.id, terms: ship.data.terms, price: String(ship.data.price), currency: ship.data.currency },
    },
  });
  revalidatePath(`/trips/${s.trip.id}`);
  return { ok: true };
}

/** Menejer haydovchi o'rniga holatni belgilaydi (telefon buzilgan, internet yo'q va h.k.). */
export async function addTripEvent(tripId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await editor();
  const type = str(formData, "type") as TripEventType;
  const at = parseTashkentDateTime(str(formData, "at"));
  if (!EVENT_ORDER.includes(type) || !at) return fail("common.required", formData);
  let completed = false;
  try {
    await db.$transaction(async (tx) => {
      await lockOrg(tx, orgId);
      const trip = await tx.trip.findFirst({ where: { id: tripId, orgId } });
      if (!trip) throw new ForbiddenError();
      if (trip.status === "CANCELLED") throw new FormError("trip.error.closed");
      const done = await doneEvents(tx, tripId);
      const check = checkEvent(type, at, done);
      if (!check.ok) throw new FormError(check.error);
      await tx.tripEvent.create({ data: { tripId, type, at, source: "MANAGER", userId: user.id, note: optStr(formData, "note", 300) } });
      if (completesTrip({ ...done, [type]: at })) {
        await tx.trip.update({ where: { id: tripId }, data: { status: "COMPLETED" } });
        completed = true;
      }
    });
  } catch (e) {
    if (e instanceof FormError) return fail(e.key, formData);
    throw e;
  }
  await audit({ actorId: user.id, orgId, action: "trip.event", entity: "Trip", entityId: tripId, details: { type, at: at.toISOString(), source: "MANAGER" } });
  // Xodim haydovchiga reys haqi (kartochkasida belgilangan bo'lsa) — avtomatik.
  if (completed && (await autoTripCharge(tripId, user.id))) revalidatePath("/settlements/drivers", "layout");
  revalidatePath(`/trips/${tripId}`);
  return { ok: true };
}

/** Tashishni bekor qilish (o'chirilmaydi): transport bo'shaydi, tarix saqlanadi. */
export async function cancelTrip(tripId: string): Promise<FormState> {
  const { user, orgId } = await editor();
  const trip = await db.trip.findFirst({ where: { id: tripId, ...orgScope(user) } });
  if (!trip) throw new ForbiddenError();
  if (trip.status !== "ACTIVE") return { error: "trip.error.closed" };
  await db.trip.update({ where: { id: tripId }, data: { status: "CANCELLED" } });
  await audit({ actorId: user.id, orgId, action: "trip.status", entity: "Trip", entityId: tripId, details: { status: "CANCELLED" } });
  revalidatePath(`/trips/${tripId}`);
  return { ok: true };
}
