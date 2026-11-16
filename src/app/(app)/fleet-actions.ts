"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { DocType, DriverCategory, Ownership, Status, VehicleType } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requirePermission, requireSection, requireUser } from "@/lib/session";
import { orgForWrite, orgScope, ForbiddenError } from "@/lib/scope";
import { normalizePhone } from "@/lib/phone";
import { parseDate } from "@/lib/dates";
import { checkFile, MAX_FILE_BYTES } from "@/lib/files";
import { DOC_TYPES, FILE_REQUIRED, normalizePlate, type DocOwnerKind } from "@/lib/docs";
import { fail, optStr, str, type FormState } from "@/lib/form";
import { tractorCapacity } from "@/lib/billing";

const VEHICLE_TYPES: VehicleType[] = ["TRACTOR", "TRAILER", "TRAIN", "OTHER"];
const OWNERSHIPS: Ownership[] = ["OWNED", "LEASED"];
const CATEGORIES: DriverCategory[] = ["EMPLOYEE", "OWNER_OPERATOR"];
const LIFECYCLE: Status[] = ["ACTIVE", "ARCHIVED"];

/** Bo'lim bo'yicha tahrirlash huquqi (menejer yoki shu bo'limga ruxsat berilgan Mutaxassis); tashkilot sessiyadan olinadi. */
async function editor(section: "vehicles" | "drivers" | "trips") {
  const user = await requireSection(section, "EDIT");
  return { user, orgId: orgForWrite(user) };
}

// ---------- Transport ----------

function vehicleInput(formData: FormData) {
  const plate = normalizePlate(str(formData, "plate"));
  const type = str(formData, "type") as VehicleType;
  const ownership = str(formData, "ownership") as Ownership;
  if (!plate || plate.length > 20 || !VEHICLE_TYPES.includes(type) || !OWNERSHIPS.includes(ownership)) return null;
  const leased = ownership === "LEASED";
  return {
    plate,
    type,
    ownership,
    model: optStr(formData, "model", 100),
    leaseOwner: leased ? optStr(formData, "leaseOwner", 200) : null,
    leaseStart: leased ? parseDate(formData.get("leaseStart")) : null,
    leaseEnd: leased ? parseDate(formData.get("leaseEnd")) : null,
    note: optStr(formData, "note"),
  };
}

async function plateTaken(orgId: string, plate: string, exceptId?: string) {
  const found = await db.vehicle.findFirst({
    where: { orgId, plate, status: "ACTIVE", ...(exceptId ? { NOT: { id: exceptId } } : {}) },
  });
  return !!found;
}

export async function createVehicle(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await editor("vehicles");
  const data = vehicleInput(formData);
  if (!data) return fail("common.required", formData);
  if (await plateTaken(orgId, data.plate)) return fail("veh.error.plate", formData);
  if (data.type === "TRACTOR" && !(await tractorCapacity(orgId)).ok) return fail("sub.error.limit", formData);
  const v = await db.vehicle.create({ data: { ...data, orgId } });
  await audit({ actorId: user.id, orgId, action: "vehicle.create", entity: "Vehicle", entityId: v.id, details: { plate: v.plate } });
  redirect(`/vehicles/${v.id}`);
}

export async function updateVehicle(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await editor("vehicles");
  const current = await db.vehicle.findFirst({ where: { id, ...orgScope(user) } });
  if (!current) throw new ForbiddenError();
  const data = vehicleInput(formData);
  if (!data) return fail("common.required", formData);
  if (await plateTaken(orgId, data.plate, id)) return fail("veh.error.plate", formData);
  // Faol transport tyagachga aylantirilsa, tarif chegarasi tekshiriladi.
  if (data.type === "TRACTOR" && current.type !== "TRACTOR" && current.status === "ACTIVE" && !(await tractorCapacity(orgId)).ok) {
    return fail("sub.error.limit", formData);
  }

  // Juftlik faqat tyagach uchun va faqat o'z tashkilotidagi faol prisept/haydovchidan.
  let pairTrailerId: string | null = null;
  let pairDriverId: string | null = null;
  if (data.type === "TRACTOR") {
    const trailerId = str(formData, "pairTrailerId");
    const driverId = str(formData, "pairDriverId");
    if (trailerId) {
      const t = await db.vehicle.findFirst({ where: { id: trailerId, orgId, type: "TRAILER", status: "ACTIVE" } });
      if (!t) throw new ForbiddenError();
      pairTrailerId = t.id;
    }
    if (driverId) {
      const d = await db.driver.findFirst({ where: { id: driverId, orgId, status: "ACTIVE" } });
      if (!d) throw new ForbiddenError();
      pairDriverId = d.id;
    }
  }
  await db.vehicle.update({ where: { id }, data: { ...data, pairTrailerId, pairDriverId } });
  await audit({
    actorId: user.id, orgId, action: "vehicle.update", entity: "Vehicle", entityId: id,
    details: { ...data, pairTrailerId, pairDriverId, leaseStart: data.leaseStart?.toISOString() ?? null, leaseEnd: data.leaseEnd?.toISOString() ?? null },
  });
  revalidatePath(`/vehicles/${id}`);
  return { ok: true };
}

export async function setVehicleStatus(id: string, status: Status) {
  const { user, orgId } = await editor("vehicles");
  if (!LIFECYCLE.includes(status)) return;
  const v = await db.vehicle.findFirst({ where: { id, ...orgScope(user) } });
  if (!v) throw new ForbiddenError();
  if (status === "ACTIVE" && (await plateTaken(orgId, v.plate, id))) return;
  if (status === "ACTIVE" && v.status !== "ACTIVE" && v.type === "TRACTOR" && !(await tractorCapacity(orgId)).ok) {
    redirect(`/vehicles/${id}?limit=1`);
  }
  await db.$transaction([
    db.vehicle.update({
      where: { id },
      data: { status, ...(status === "ARCHIVED" ? { pairTrailerId: null, pairDriverId: null } : {}) },
    }),
    // Arxivlangan prisept boshqa tyagachlarning juftligidan chiqariladi.
    ...(status === "ARCHIVED" ? [db.vehicle.updateMany({ where: { orgId, pairTrailerId: id }, data: { pairTrailerId: null } })] : []),
  ]);
  await audit({ actorId: user.id, orgId, action: "vehicle.status", entity: "Vehicle", entityId: id, details: { status } });
  revalidatePath(`/vehicles/${id}`);
}

export type DeleteState = { error?: "veh.error.deleteLinked" };

/**
 * Transportni butunlay o'chirish — faqat xato kiritilgan, tarixi yo'q transport uchun (hujjati yo'q).
 * Tarixi bor transport o'chirilmaydi, nofaol (arxiv) qilinadi: texnik shart — ma'lumot yo'qolmasligi.
 */
export async function deleteVehicle(id: string, _prev: DeleteState): Promise<DeleteState> {
  // Menejer yoki transport bo'limiga "tahrirlash va o'chirish" huquqi berilgan Mutaxassis.
  const user = (await requireUser()).role === "SPECIALIST" ? await requireSection("vehicles", "EDIT") : await requirePermission("vehicle.delete");
  const v = await db.vehicle.findFirst({
    where: { id, ...orgScope(user) },
    include: { _count: { select: { documents: true, tripsAsTractor: true, tripsAsTrailer: true } } },
  });
  if (!v) throw new ForbiddenError();
  if (v._count.documents + v._count.tripsAsTractor + v._count.tripsAsTrailer > 0) return { error: "veh.error.deleteLinked" };
  await db.$transaction([
    // Shu prisept boshqa tyagachlarning standart juftligida bo'lsa, juftlikdan chiqariladi.
    db.vehicle.updateMany({ where: { orgId: v.orgId, pairTrailerId: id }, data: { pairTrailerId: null } }),
    db.vehicle.delete({ where: { id } }),
  ]);
  await audit({ actorId: user.id, orgId: v.orgId, action: "vehicle.delete", entity: "Vehicle", entityId: id, details: { plate: v.plate, type: v.type } });
  redirect("/vehicles");
}

// ---------- Haydovchilar ----------

function driverInput(formData: FormData) {
  const fullName = str(formData, "fullName").slice(0, 200);
  const category = str(formData, "category") as DriverCategory;
  if (!fullName || !CATEGORIES.includes(category)) return null;
  const rawPhone = str(formData, "phone");
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (rawPhone && !phone) return "phone" as const;
  return { fullName, category, phone, note: optStr(formData, "note") };
}

export async function createDriver(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await editor("drivers");
  const data = driverInput(formData);
  if (data === "phone") return fail("user.error.phone", formData);
  if (!data) return fail("common.required", formData);
  const d = await db.driver.create({ data: { ...data, orgId } });
  await audit({ actorId: user.id, orgId, action: "driver.create", entity: "Driver", entityId: d.id, details: { fullName: d.fullName } });
  redirect(`/drivers/${d.id}`);
}

export async function updateDriver(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await editor("drivers");
  const current = await db.driver.findFirst({ where: { id, ...orgScope(user) } });
  if (!current) throw new ForbiddenError();
  const data = driverInput(formData);
  if (data === "phone") return fail("user.error.phone", formData);
  if (!data) return fail("common.required", formData);
  // Telefon o'zgarsa Telegram bog'lanishi uziladi: yangi raqam egasi botga qaytadan ulanadi.
  const unlink = current.phone !== data.phone ? { telegramChatId: null, telegramLinkedAt: null } : {};
  await db.driver.update({ where: { id }, data: { ...data, ...unlink } });
  await audit({ actorId: user.id, orgId, action: "driver.update", entity: "Driver", entityId: id, details: data });
  revalidatePath(`/drivers/${id}`);
  return { ok: true };
}

export async function setDriverStatus(id: string, status: Status) {
  const { user, orgId } = await editor("drivers");
  if (!LIFECYCLE.includes(status)) return;
  if (!(await db.driver.findFirst({ where: { id, ...orgScope(user) } }))) throw new ForbiddenError();
  await db.$transaction([
    db.driver.update({ where: { id }, data: { status } }),
    ...(status === "ARCHIVED" ? [db.vehicle.updateMany({ where: { orgId, pairDriverId: id }, data: { pairDriverId: null } })] : []),
  ]);
  await audit({ actorId: user.id, orgId, action: "driver.status", entity: "Driver", entityId: id, details: { status } });
  revalidatePath(`/drivers/${id}`);
}

// ---------- Hujjatlar ----------

type Owner = { kind: DocOwnerKind; id: string };

/** Hujjat egasiga qarab: transport/haydovchi — menejer; tashkilot — menejer, rahbar, buxgalter. */
async function docEditor(owner: Owner) {
  if (owner.kind !== "org") {
    const { user, orgId } = await editor(owner.kind === "vehicle" ? "vehicles" : owner.kind === "driver" ? "drivers" : "trips");
    const scope = orgScope(user);
    const row =
      owner.kind === "vehicle"
        ? await db.vehicle.findFirst({ where: { id: owner.id, ...scope } })
        : owner.kind === "driver"
          ? await db.driver.findFirst({ where: { id: owner.id, ...scope } })
          : await db.trip.findFirst({ where: { id: owner.id, ...scope } });
    if (!row) throw new ForbiddenError();
    return { user, orgId };
  }
  const user = await requireSection("orgdocs", "EDIT");
  // Tashkilot foydalanuvchisi uchun har doim o'z tashkiloti; buxgalter tanlagan tashkilot mavjud va faol bo'lishi shart.
  const orgId = orgForWrite(user, owner.id);
  const org = await db.organization.findFirst({ where: { id: orgId, status: "ACTIVE" } });
  if (!org) throw new ForbiddenError();
  return { user, orgId };
}

function ownerWhere(owner: Owner, orgId: string) {
  if (owner.kind === "vehicle") return { vehicleId: owner.id };
  if (owner.kind === "driver") return { driverId: owner.id };
  if (owner.kind === "trip") return { tripId: owner.id };
  return { orgId, vehicleId: null, driverId: null, tripId: null };
}

function ownerPath(owner: Owner) {
  if (owner.kind === "vehicle") return `/vehicles/${owner.id}`;
  if (owner.kind === "driver") return `/drivers/${owner.id}`;
  if (owner.kind === "trip") return `/trips/${owner.id}`;
  return "/org-docs";
}

/**
 * Yangi hujjat qo'shadi. `renewOf` berilsa, bu yangi versiya: eski hujjat ARXIV bo'ladi, yangisi FAOL,
 * va `prevId` orqali bog'lanadi. Eski yozuv hech qachon o'chirilmaydi.
 */
export async function addDocument(owner: Owner, renewOf: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await docEditor(owner);

  let prev = null;
  if (renewOf) {
    prev = await db.document.findFirst({ where: { id: renewOf, orgId, status: "ACTIVE", ...ownerWhere(owner, orgId) } });
    if (!prev) throw new ForbiddenError();
  }

  const type = (prev?.type ?? str(formData, "type")) as DocType;
  if (!DOC_TYPES[owner.kind].includes(type)) return fail("common.required", formData);
  // "Boshqa" turidagi hujjatga foydalanuvchi o'zi nom beradi (yangilanganda eski nom saqlanadi).
  const title = type === "OTHER" ? (prev?.title ?? optStr(formData, "title", 100)) : null;
  if (type === "OTHER" && !title) return fail("doc.titleRequired", formData);

  const file = formData.get("file");
  let fileData: { bytes: Uint8Array; mime: string; name: string } | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE_BYTES) return fail("doc.error.size", formData);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = checkFile(bytes, file.name);
    if (!check.ok) return fail(check.error === "type" ? "doc.error.type" : "doc.error.size", formData);
    fileData = { bytes, mime: check.mime, name: file.name.slice(0, 200) || "file" };
  }
  if (!fileData && FILE_REQUIRED.includes(type)) return fail("doc.fileRequired", formData);

  const doc = await db.$transaction(async (tx) => {
    const stored = fileData
      ? await tx.storedFile.create({
          data: { orgId, name: fileData.name, mime: fileData.mime, size: fileData.bytes.byteLength, data: Buffer.from(fileData.bytes), uploadedById: user.id },
        })
      : null;
    if (prev) await tx.document.update({ where: { id: prev.id }, data: { status: "ARCHIVED" } });
    return tx.document.create({
      data: {
        orgId,
        type,
        vehicleId: owner.kind === "vehicle" ? owner.id : null,
        driverId: owner.kind === "driver" ? owner.id : null,
        tripId: owner.kind === "trip" ? owner.id : null,
        title,
        number: optStr(formData, "number", 100),
        issuedAt: parseDate(formData.get("issuedAt")),
        // Muddatsiz (doimiy) hujjatda amal qilish muddati saqlanmaydi.
        expiresAt: formData.get("noExpiry") === "on" ? null : parseDate(formData.get("expiresAt")),
        noExpiry: formData.get("noExpiry") === "on",
        note: optStr(formData, "note"),
        fileId: stored?.id ?? null,
        prevId: prev?.id ?? null,
        createdById: user.id,
      },
    });
  });
  await audit({
    actorId: user.id, orgId, action: prev ? "document.renew" : "document.create", entity: "Document", entityId: doc.id,
    details: { type, title, number: doc.number, prevId: prev?.id ?? null, file: fileData ? { name: fileData.name, size: fileData.bytes.byteLength } : null },
  });
  revalidatePath(ownerPath(owner));
  return { ok: true };
}

export async function archiveDocument(id: string) {
  const user = await requireUser();
  const doc = await db.document.findFirst({ where: { id, ...orgScope(user), status: "ACTIVE" } });
  if (!doc) throw new ForbiddenError();
  const owner: Owner = doc.vehicleId
    ? { kind: "vehicle", id: doc.vehicleId }
    : doc.driverId
      ? { kind: "driver", id: doc.driverId }
      : doc.tripId
        ? { kind: "trip", id: doc.tripId }
        : { kind: "org", id: doc.orgId };
  // Huquq hujjat egasiga qarab qayta tekshiriladi (tashkilot filtri ham shu ichida).
  const { user: actor, orgId } = await docEditor(owner);
  await db.document.update({ where: { id }, data: { status: "ARCHIVED" } });
  await audit({ actorId: actor.id, orgId, action: "document.status", entity: "Document", entityId: id, details: { status: "ARCHIVED" } });
  revalidatePath(ownerPath(owner));
}
