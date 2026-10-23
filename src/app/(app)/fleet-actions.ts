"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { DocType, DriverCategory, Ownership, Status, VehicleType } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { orgForWrite, orgScope, ForbiddenError } from "@/lib/scope";
import { normalizePhone } from "@/lib/phone";
import { parseDate } from "@/lib/dates";
import { checkFile } from "@/lib/files";
import { DRIVER_DOC_TYPES, FILE_REQUIRED, VEHICLE_DOC_TYPES, normalizePlate } from "@/lib/docs";
import { fail, optStr, str, type FormState } from "@/lib/form";

const VEHICLE_TYPES: VehicleType[] = ["TRACTOR", "TRAILER", "TRAIN", "OTHER"];
const OWNERSHIPS: Ownership[] = ["OWNED", "LEASED"];
const CATEGORIES: DriverCategory[] = ["EMPLOYEE", "OWNER_OPERATOR"];
const LIFECYCLE: Status[] = ["ACTIVE", "ARCHIVED"];

/** Faqat menejer kiritadi; tashkilot sessiyadan olinadi. */
async function editor() {
  const user = await requirePermission("data.edit");
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
  const { user, orgId } = await editor();
  const data = vehicleInput(formData);
  if (!data) return fail("common.required", formData);
  if (await plateTaken(orgId, data.plate)) return fail("veh.error.plate", formData);
  const v = await db.vehicle.create({ data: { ...data, orgId } });
  await audit({ actorId: user.id, orgId, action: "vehicle.create", entity: "Vehicle", entityId: v.id, details: { plate: v.plate } });
  redirect(`/vehicles/${v.id}`);
}

export async function updateVehicle(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await editor();
  const current = await db.vehicle.findFirst({ where: { id, ...orgScope(user) } });
  if (!current) throw new ForbiddenError();
  const data = vehicleInput(formData);
  if (!data) return fail("common.required", formData);
  if (await plateTaken(orgId, data.plate, id)) return fail("veh.error.plate", formData);

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
  const { user, orgId } = await editor();
  if (!LIFECYCLE.includes(status)) return;
  const v = await db.vehicle.findFirst({ where: { id, ...orgScope(user) } });
  if (!v) throw new ForbiddenError();
  if (status === "ACTIVE" && (await plateTaken(orgId, v.plate, id))) return;
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
  const { user, orgId } = await editor();
  const data = driverInput(formData);
  if (data === "phone") return fail("user.error.phone", formData);
  if (!data) return fail("common.required", formData);
  const d = await db.driver.create({ data: { ...data, orgId } });
  await audit({ actorId: user.id, orgId, action: "driver.create", entity: "Driver", entityId: d.id, details: { fullName: d.fullName } });
  redirect(`/drivers/${d.id}`);
}

export async function updateDriver(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await editor();
  if (!(await db.driver.findFirst({ where: { id, ...orgScope(user) } }))) throw new ForbiddenError();
  const data = driverInput(formData);
  if (data === "phone") return fail("user.error.phone", formData);
  if (!data) return fail("common.required", formData);
  await db.driver.update({ where: { id }, data });
  await audit({ actorId: user.id, orgId, action: "driver.update", entity: "Driver", entityId: id, details: data });
  revalidatePath(`/drivers/${id}`);
  return { ok: true };
}

export async function setDriverStatus(id: string, status: Status) {
  const { user, orgId } = await editor();
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

type Owner = { kind: "vehicle" | "driver"; id: string };

/**
 * Yangi hujjat qo'shadi. `renewOf` berilsa, bu yangi versiya: eski hujjat ARXIV bo'ladi, yangisi FAOL,
 * va `prevId` orqali bog'lanadi. Eski yozuv hech qachon o'chirilmaydi.
 */
export async function addDocument(owner: Owner, renewOf: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await editor();
  const scope = orgScope(user);
  const ownerRow =
    owner.kind === "vehicle"
      ? await db.vehicle.findFirst({ where: { id: owner.id, ...scope } })
      : await db.driver.findFirst({ where: { id: owner.id, ...scope } });
  if (!ownerRow) throw new ForbiddenError();

  let prev = null;
  if (renewOf) {
    prev = await db.document.findFirst({
      where: { id: renewOf, ...scope, status: "ACTIVE", ...(owner.kind === "vehicle" ? { vehicleId: owner.id } : { driverId: owner.id }) },
    });
    if (!prev) throw new ForbiddenError();
  }

  const type = (prev?.type ?? str(formData, "type")) as DocType;
  const allowed = owner.kind === "vehicle" ? VEHICLE_DOC_TYPES : DRIVER_DOC_TYPES;
  if (!allowed.includes(type)) return fail("common.required", formData);

  const file = formData.get("file");
  let fileData: { bytes: Uint8Array; mime: string; name: string } | null = null;
  if (file instanceof File && file.size > 0) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = checkFile(bytes);
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
        number: optStr(formData, "number", 100),
        issuedAt: parseDate(formData.get("issuedAt")),
        expiresAt: parseDate(formData.get("expiresAt")),
        note: optStr(formData, "note"),
        fileId: stored?.id ?? null,
        prevId: prev?.id ?? null,
        createdById: user.id,
      },
    });
  });
  await audit({
    actorId: user.id, orgId, action: prev ? "document.renew" : "document.create", entity: "Document", entityId: doc.id,
    details: { type, number: doc.number, prevId: prev?.id ?? null, file: fileData ? { name: fileData.name, size: fileData.bytes.byteLength } : null },
  });
  revalidatePath(`/${owner.kind === "vehicle" ? "vehicles" : "drivers"}/${owner.id}`);
  return { ok: true };
}

export async function archiveDocument(id: string) {
  const { user, orgId } = await editor();
  const doc = await db.document.findFirst({ where: { id, ...orgScope(user), status: "ACTIVE" } });
  if (!doc) throw new ForbiddenError();
  await db.document.update({ where: { id }, data: { status: "ARCHIVED" } });
  await audit({ actorId: user.id, orgId, action: "document.status", entity: "Document", entityId: id, details: { status: "ARCHIVED" } });
  revalidatePath(doc.vehicleId ? `/vehicles/${doc.vehicleId}` : `/drivers/${doc.driverId}`);
}
