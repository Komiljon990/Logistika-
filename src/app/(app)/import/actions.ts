"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireSection } from "@/lib/session";
import { orgForWrite } from "@/lib/scope";
import { normalizePhone } from "@/lib/phone";
import { normalizePlate } from "@/lib/docs";
import { normalizeInn } from "@/lib/billing-core";
import { tractorCapacity } from "@/lib/billing";
import { readTable } from "@/lib/xlsx-read";
import { driverCategory, IMPORT_KINDS, mapHeaders, ownership, pick, vehicleType, type ImportKind } from "@/lib/import-core";

export type ImportState = {
  ok?: boolean;
  error?: "imp.error.file" | "imp.error.headers" | "imp.error.empty" | "imp.error.big";
  added?: number;
  skipped?: { row: number; reason: "dup" | "invalid" | "limit" | "phone" }[];
};

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 2000;

/**
 * Exceldan (yoki CSV) import: birinchi qator — sarlavhalar, keyingilar — yozuvlar. Takrorlar (STIR/nom, davlat raqami,
 * telefon/F.I.Sh.) o'tkazib yuboriladi, tyagachlar tarif chegarasidan oshmaydi. Har o'tkazilgan qator sababi bilan qaytadi.
 */
export async function importRows(kind: ImportKind, _prev: ImportState, formData: FormData): Promise<ImportState> {
  if (!IMPORT_KINDS.includes(kind)) return { error: "imp.error.file" };
  const user = await requireSection(kind, "EDIT");
  const orgId = orgForWrite(user);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "imp.error.file" };
  if (file.size > MAX_BYTES) return { error: "imp.error.big" };
  let rows: string[][];
  try {
    rows = readTable(file.name, Buffer.from(await file.arrayBuffer()));
  } catch {
    return { error: "imp.error.file" };
  }
  if (rows.length < 2) return { error: "imp.error.empty" };
  if (rows.length > MAX_ROWS + 1) return { error: "imp.error.big" };
  const map = mapHeaders(kind, rows[0]);
  if (!map) return { error: "imp.error.headers" };

  const skipped: NonNullable<ImportState["skipped"]> = [];
  let added = 0;
  const body = rows.slice(1);

  if (kind === "clients") {
    const existing = await db.client.findMany({ where: { orgId }, select: { name: true, inn: true } });
    const names = new Set(existing.map((c) => c.name.trim().toLowerCase()));
    const inns = new Set(existing.map((c) => c.inn).filter(Boolean));
    for (const [i, r] of body.entries()) {
      const f = pick(r, map);
      const name = f.name.slice(0, 200);
      if (!name) { skipped.push({ row: i + 2, reason: "invalid" }); continue; }
      const inn = f.inn ? normalizeInn(f.inn) : null;
      if (names.has(name.toLowerCase()) || (inn && inns.has(inn))) { skipped.push({ row: i + 2, reason: "dup" }); continue; }
      await db.client.create({
        data: { orgId, name, inn, phone: f.phone ? (normalizePhone(f.phone) ?? f.phone.slice(0, 30)) : null, address: f.address?.slice(0, 300) || null, note: f.note?.slice(0, 500) || null },
      });
      names.add(name.toLowerCase());
      if (inn) inns.add(inn);
      added++;
    }
  }

  if (kind === "vehicles") {
    const existing = await db.vehicle.findMany({ where: { orgId, status: "ACTIVE" }, select: { plate: true } });
    const plates = new Set(existing.map((v) => v.plate));
    let cap = await tractorCapacity(orgId);
    for (const [i, r] of body.entries()) {
      const f = pick(r, map);
      const plate = normalizePlate(f.plate);
      if (!plate || plate.length > 20) { skipped.push({ row: i + 2, reason: "invalid" }); continue; }
      if (plates.has(plate)) { skipped.push({ row: i + 2, reason: "dup" }); continue; }
      const type = vehicleType(f.type ?? "");
      if (type === "TRACTOR" && !cap.ok) { skipped.push({ row: i + 2, reason: "limit" }); continue; }
      await db.vehicle.create({ data: { orgId, plate, type, ownership: ownership(f.ownership ?? ""), model: f.model?.slice(0, 100) || null, note: f.note?.slice(0, 500) || null } });
      plates.add(plate);
      added++;
      if (type === "TRACTOR") cap = await tractorCapacity(orgId);
    }
  }

  if (kind === "drivers") {
    const existing = await db.driver.findMany({ where: { orgId, status: "ACTIVE" }, select: { fullName: true, phone: true } });
    const names = new Set(existing.map((d) => d.fullName.trim().toLowerCase()));
    const phones = new Set(existing.map((d) => d.phone).filter(Boolean));
    for (const [i, r] of body.entries()) {
      const f = pick(r, map);
      const fullName = f.fullName.slice(0, 200);
      if (!fullName) { skipped.push({ row: i + 2, reason: "invalid" }); continue; }
      const phone = f.phone ? normalizePhone(f.phone) : null;
      if (f.phone && !phone) { skipped.push({ row: i + 2, reason: "phone" }); continue; }
      if (names.has(fullName.toLowerCase()) || (phone && phones.has(phone))) { skipped.push({ row: i + 2, reason: "dup" }); continue; }
      await db.driver.create({ data: { orgId, fullName, phone, category: driverCategory(f.category ?? ""), note: f.note?.slice(0, 500) || null } });
      names.add(fullName.toLowerCase());
      if (phone) phones.add(phone);
      added++;
    }
  }

  await audit({ actorId: user.id, orgId, action: "import", entity: kind, entityId: orgId, details: { file: file.name.slice(0, 120), added, skipped: skipped.length } });
  revalidatePath(`/${kind}`);
  return { ok: true, added, skipped: skipped.slice(0, 200) };
}
