"use server";

import { revalidatePath } from "next/cache";
import type { PermitFormat, PermitMoveKind, PermitType } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireSection, requireUser } from "@/lib/session";
import { orgForWrite, ForbiddenError } from "@/lib/scope";
import { parseDate } from "@/lib/dates";
import { tashkentToday } from "@/lib/docs";
import { canDo, nextStatus, parseNumbers, permitSection, type PermitAction } from "@/lib/permits-core";
import { fail, optStr, str, type FormState } from "@/lib/form";
import { notifyDriverMove } from "@/lib/telegram-bot";

const TYPES: PermitType[] = ["TIR", "DAZVOL"];

/** TIR va dazvollarni menejer (yoki shu bo'limga ruxsati bor Mutaxassis) yuritadi; TIR va dazvol — alohida bo'lim. */
async function editor(type: PermitType) {
  const user = await requireSection(permitSection(type), "EDIT");
  return { user, orgId: orgForWrite(user) };
}

/** Mavjud blanka bo'yicha amal: huquq uning turiga qarab (TIR yoki dazvol). */
async function editorForPermit(id: string) {
  const u = await requireUser();
  const p = await db.permit.findFirst({ where: { id, orgId: orgForWrite(u) }, select: { type: true } });
  if (!p) throw new ForbiddenError();
  return editor(p.type);
}

const today = () => tashkentToday().toISOString().slice(0, 10);

function refresh() {
  revalidatePath("/tir", "layout");
  revalidatePath("/dazvol", "layout");
}

/** Kirim: yuqori tashkilotdan olingan blankalar (bir yoki bir nechta raqam, oraliq ham mumkin). */
export async function receivePermits(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const type = str(formData, "type") as PermitType;
  if (!TYPES.includes(type)) return fail("common.required", formData);
  const { user, orgId } = await editor(type);
  const numbers = parseNumbers(str(formData, "numbers"));
  if (!numbers) return fail("tir.error.numbers", formData);
  const receivedAt = parseDate(formData.get("receivedAt"));
  if (!receivedAt || receivedAt.toISOString().slice(0, 10) > today()) return fail("pay.error.date", formData);
  // Amal qilish muddati majburiy (17.11.2026): muddati yaqinlashsa ogohlantirish chiqadi.
  const validUntil = parseDate(formData.get("validUntil"));
  if (!validUntil) return fail("tir.error.validUntil", formData);
  const issuer = optStr(formData, "issuer", 200);
  const country = type === "DAZVOL" ? optStr(formData, "country", 100) : null;
  if (type === "DAZVOL" && !country) return fail("tir.error.country", formData);
  // Dazvol ikki xil (17.11.2026): qog'oz blanka yoki elektron.
  const fmt = str(formData, "format");
  const format: PermitFormat | null = type === "DAZVOL" ? (fmt === "PAPER" || fmt === "ELECTRONIC" ? fmt : null) : null;
  if (type === "DAZVOL" && !format) return fail("tir.error.format", formData);
  // Shu raqam tashkilotda hali yopilmagan (topshirilmagan) bo'lsa — ikkinchi marta kiritilmaydi.
  const dup = await db.permit.findMany({ where: { orgId, type, number: { in: numbers }, status: { notIn: ["SURRENDERED", "LOST"] } }, select: { number: true } });
  if (dup.length) {
    const f = fail("tir.error.duplicate", formData);
    return { ...f, values: { ...f.values, dup: dup.map((x) => x.number).join(", ") } };
  }
  const base = { orgId, type, format, receivedAt, validUntil, issuer, country, kind: optStr(formData, "kind", 100), note: optStr(formData, "note", 300), createdById: user.id };
  for (const number of numbers) {
    const p = await db.permit.create({ data: { ...base, number, moves: { create: { orgId, kind: "RECEIVED", date: receivedAt, note: issuer, createdById: user.id } } } });
    await audit({ actorId: user.id, orgId, action: "permit.receive", entity: "Permit", entityId: p.id, details: { type, number } });
  }
  refresh();
  return { ok: true };
}

async function loadPermit(id: string, orgId: string) {
  const p = await db.permit.findFirst({ where: { id, orgId }, include: { moves: { orderBy: { date: "desc" }, take: 1 } } });
  if (!p) throw new ForbiddenError();
  return p;
}

/** Amal sanasi: bugundan keyin emas va oxirgi harakatdan oldin emas. */
function actionDate(formData: FormData, last: Date | undefined): Date | null {
  const d = parseDate(formData.get("date"));
  if (!d || d.toISOString().slice(0, 10) > today()) return null;
  if (last && d < last) return null;
  return d;
}

async function move(id: string, action: PermitAction, formData: FormData): Promise<FormState> {
  const { user, orgId } = await editorForPermit(id);
  const p = await loadPermit(id, orgId);
  if (!canDo(action, p.status)) return fail("tir.error.state", formData);
  const date = action === "LOST" ? parseDate(formData.get("date")) ?? new Date(today()) : actionDate(formData, p.moves[0]?.date);
  if (!date) return fail("tir.error.date", formData);
  const note = optStr(formData, "note", 300);
  let vehicle: { id: string; plate: string } | null = null;
  let driver: { id: string; fullName: string } | null = null;
  if (action === "ISSUE") {
    vehicle = await db.vehicle.findFirst({ where: { id: str(formData, "vehicleId"), orgId, status: "ACTIVE" }, select: { id: true, plate: true } });
    driver = await db.driver.findFirst({ where: { id: str(formData, "driverId"), orgId, status: "ACTIVE" }, select: { id: true, fullName: true } });
    if (!vehicle || !driver) return fail("tir.error.holder", formData);
  }
  const used = action === "RETURN" ? formData.get("used") === "on" : null;
  const status = nextStatus(action, !!used);
  const kind: PermitMoveKind = action === "ISSUE" ? "ISSUED" : action === "RETURN" ? "RETURNED" : action === "SURRENDER" ? "SURRENDERED" : "LOST";
  // Qaytarish/topshirishda kimda bo'lgani jurnalda qoladi.
  const holder = action === "RETURN"
    ? await db.permit.findUnique({ where: { id }, select: { vehicle: { select: { id: true, plate: true } }, driver: { select: { id: true, fullName: true } } } })
    : null;
  const done = await db.permit.updateMany({
    where: { id, status: p.status },
    data: {
      status,
      vehicleId: action === "ISSUE" ? vehicle!.id : null,
      driverId: action === "ISSUE" ? driver!.id : null,
      issuedAt: action === "ISSUE" ? date : null,
    },
  });
  if (done.count !== 1) return fail("tir.error.state", formData);
  const v = vehicle ?? holder?.vehicle ?? null;
  const dr = driver ?? holder?.driver ?? null;
  const mv = await db.permitMove.create({
    data: { permitId: id, orgId, kind, date, vehicleId: v?.id ?? null, plate: v?.plate ?? null, driverId: dr?.id ?? null, driverName: dr?.fullName ?? null, used, note, createdById: user.id },
  });
  await audit({ actorId: user.id, orgId, action: `permit.${action.toLowerCase()}`, entity: "Permit", entityId: id, details: { number: p.number, status, used } });
  // Berildi / qaytarildi — haydovchiga bot orqali tasdiqlash so'rovi.
  if (kind === "ISSUED" || kind === "RETURNED") await notifyDriverMove(mv.id);
  refresh();
  return { ok: true };
}

/**
 * Haydovchi "olmadim" deb rad etgan berishni bekor qilish: blanka yana tashkilotda, jurnalda izoh bilan qoladi.
 * Faqat oxirgi harakat shu rad etilgan berish bo'lsa.
 */
export async function cancelRejectedIssue(id: string): Promise<FormState> {
  const { user, orgId } = await editorForPermit(id);
  const p = await db.permit.findFirst({ where: { id, orgId }, include: { moves: { orderBy: { createdAt: "desc" }, take: 1 } } });
  if (!p) throw new ForbiddenError();
  const last = p.moves[0];
  if (p.status !== "ISSUED" || last?.kind !== "ISSUED" || last.ack !== "REJECTED") return { error: "tir.error.state" };
  const done = await db.permit.updateMany({ where: { id, status: "ISSUED" }, data: { status: "STOCK", vehicleId: null, driverId: null, issuedAt: null } });
  if (done.count !== 1) return { error: "tir.error.state" };
  await db.permitMove.create({
    data: {
      permitId: id, orgId, kind: "RETURNED", date: last.date, vehicleId: last.vehicleId, plate: last.plate, driverId: last.driverId, driverName: last.driverName,
      used: false, note: "Haydovchi olmaganini bildirdi — berish bekor qilindi", createdById: user.id,
    },
  });
  await audit({ actorId: user.id, orgId, action: "permit.cancel_issue", entity: "Permit", entityId: id, details: { number: p.number } });
  refresh();
  return { ok: true };
}

export async function issuePermit(id: string, _prev: FormState, formData: FormData) { return move(id, "ISSUE", formData); }
export async function returnPermit(id: string, _prev: FormState, formData: FormData) { return move(id, "RETURN", formData); }
export async function surrenderPermit(id: string, _prev: FormState, formData: FormData) { return move(id, "SURRENDER", formData); }
export async function lostPermit(id: string, _prev: FormState, formData: FormData) { return move(id, "LOST", formData); }

/** Xato kiritilgan blankani o'chirish: faqat hali hech kimga berilmagan (faqat kirim harakati bor). */
export async function deletePermit(id: string): Promise<FormState> {
  const { user, orgId } = await editorForPermit(id);
  const p = await db.permit.findFirst({ where: { id, orgId }, include: { _count: { select: { moves: true } } } });
  if (!p) throw new ForbiddenError();
  if (p.status !== "STOCK" || p._count.moves > 1) return { error: "tir.error.deleteUsed" };
  await db.permit.delete({ where: { id } });
  await audit({ actorId: user.id, orgId, action: "permit.delete", entity: "Permit", entityId: id, details: { type: p.type, number: p.number } });
  refresh();
  return { ok: true };
}
