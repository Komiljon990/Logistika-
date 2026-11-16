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
import { doneEvents, loadedVehicleIds, lockOrg } from "@/lib/trips";
import type { Dict } from "@/i18n";

/** Tashish, yuk va holatlarni menejer kiritadi; tashkilot sessiyadan olinadi. */
async function editor() {
  const user = await requireSection("trips", "EDIT");
  return { user, orgId: orgForWrite(user) };
}

type Tx = Prisma.TransactionClient;

type ShipmentData = Omit<Prisma.ShipmentUncheckedCreateInput, "tripId" | "orgId" | "createdById" | "clientId">;

/** Yuk qismi maydonlari (yangi tashish va qo'shimcha yuk uchun bir xil). */
async function shipmentInput(formData: FormData, orgId: string): Promise<{ data: ShipmentData } | { error: keyof Dict }> {
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
  const routeFrom = str(formData, "routeFrom").slice(0, 200);
  const routeTo = str(formData, "routeTo").slice(0, 200);
  const loadDate = parseDate(formData.get("loadDate"));
  if (!routeFrom || !routeTo || !loadDate) return fail("common.required", formData);
  const ship = await shipmentInput(formData, orgId);
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
      const client = await resolveClient(tx, formData, orgId);
      if (!client) throw new FormError("trip.error.client");
      if (client.created) newClient = client.id;
      const clientId = client.id;
      const last = await tx.trip.aggregate({ where: { orgId }, _max: { number: true } });
      const trip = await tx.trip.create({
        data: {
          orgId, number: (last._max.number ?? 0) + 1, routeFrom, routeTo, loadDate,
          tractorId: tractor.id, trailerId: trailerId || null, driverId: driver.id,
          cargo: optStr(formData, "cargo", 300), createdById: user.id,
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
  redirect(`/trips/${tripId}`);
}

/** Qo'shimcha yuk: mavjud (yuki hali tushirilmagan) tashishga yangi mijoz va yuk qismi. */
export async function addShipment(tripId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await editor();
  const ship = await shipmentInput(formData, orgId);
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

/** Menejer haydovchi o'rniga holatni belgilaydi (telefon buzilgan, internet yo'q va h.k.). */
export async function addTripEvent(tripId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await editor();
  const type = str(formData, "type") as TripEventType;
  const at = parseTashkentDateTime(str(formData, "at"));
  if (!EVENT_ORDER.includes(type) || !at) return fail("common.required", formData);
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
      if (completesTrip({ ...done, [type]: at })) await tx.trip.update({ where: { id: tripId }, data: { status: "COMPLETED" } });
    });
  } catch (e) {
    if (e instanceof FormError) return fail(e.key, formData);
    throw e;
  }
  await audit({ actorId: user.id, orgId, action: "trip.event", entity: "Trip", entityId: tripId, details: { type, at: at.toISOString(), source: "MANAGER" } });
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
