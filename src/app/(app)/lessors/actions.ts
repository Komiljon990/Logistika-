"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { LessorEntryKind, Status } from "@prisma/client";
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
import { fail, optStr, str, type FormState } from "@/lib/form";

/** Ijarachilar bilan hisob-kitob (17.11.2026): hisobchi va menejer (yoki ruxsati bor Mutaxassis) yuritadi. */
async function editor() {
  const user = await requireSection("lessors", "EDIT");
  return { user, orgId: orgForWrite(user) };
}

const today = () => tashkentToday().toISOString().slice(0, 10);

function lessorInput(formData: FormData) {
  const name = str(formData, "name").slice(0, 200);
  if (!name) return null;
  const raw = str(formData, "phone");
  const phone = raw ? normalizePhone(raw) : null;
  if (raw && !phone) return "phone" as const;
  return { name, phone, inn: optStr(formData, "inn", 20), note: optStr(formData, "note", 300) };
}

export async function createLessor(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await editor();
  const data = lessorInput(formData);
  if (data === "phone") return fail("user.error.phone", formData);
  if (!data) return fail("common.required", formData);
  const l = await db.lessor.create({ data: { ...data, orgId, createdById: user.id } });
  await audit({ actorId: user.id, orgId, action: "lessor.create", entity: "Lessor", entityId: l.id, details: { name: data.name } });
  redirect(`/lessors/${l.id}`);
}

export async function updateLessor(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await editor();
  if (!(await db.lessor.findFirst({ where: { id, orgId } }))) throw new ForbiddenError();
  const data = lessorInput(formData);
  if (data === "phone") return fail("user.error.phone", formData);
  if (!data) return fail("common.required", formData);
  await db.lessor.update({ where: { id }, data });
  await audit({ actorId: user.id, orgId, action: "lessor.update", entity: "Lessor", entityId: id, details: data });
  revalidatePath(`/lessors/${id}`);
  return { ok: true };
}

export async function setLessorStatus(id: string, status: Status): Promise<FormState> {
  const { user, orgId } = await editor();
  if (status !== "ACTIVE" && status !== "ARCHIVED") throw new ForbiddenError();
  if (!(await db.lessor.findFirst({ where: { id, orgId } }))) throw new ForbiddenError();
  await db.lessor.update({ where: { id }, data: { status } });
  await audit({ actorId: user.id, orgId, action: "lessor.status", entity: "Lessor", entityId: id, details: { status } });
  revalidatePath("/lessors", "layout");
  return { ok: true };
}

/**
 * Hisob qo'shish (ijara haqi hisoblandi — qarz oshadi) yoki to'lov (qarz kamayadi).
 * To'lov kassa yoqilgan va hisob ochilgan bo'lsa — qaysi hisobdan ekani majburiy, valyuta shu hisobniki.
 */
export async function addLessorEntry(lessorId: string, kind: LessorEntryKind, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await editor();
  if (kind !== "CHARGE" && kind !== "PAYMENT") throw new ForbiddenError();
  const lessor = await db.lessor.findFirst({ where: { id: lessorId, orgId, status: "ACTIVE" } });
  if (!lessor) throw new ForbiddenError();
  const date = parseDate(formData.get("date"));
  if (!date || date.toISOString().slice(0, 10) > today()) return fail("pay.error.date", formData);
  const amount = parseAmount(str(formData, "amount"));
  if (amount === null || amount <= 0 || amount > 1e13) return fail("pay.error.amount", formData);
  let currency = str(formData, "currency");
  let accountId: string | null = null;
  if (kind === "PAYMENT" && (await cashEnabled(orgId)) && (await db.cashAccount.count({ where: { orgId, status: "ACTIVE" } })) > 0) {
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
  const e = await db.lessorEntry.create({
    data: {
      orgId, lessorId, kind, date, amount, currency, accountId, vehicleId: vehicle?.id ?? null, plate: vehicle?.plate ?? null,
      note: optStr(formData, "note", 300), createdById: user.id,
    },
  });
  await audit({ actorId: user.id, orgId, action: kind === "CHARGE" ? "lessor.charge" : "lessor.payment", entity: "LessorEntry", entityId: e.id, details: { lessorId, amount, currency, accountId } });
  revalidatePath(`/lessors/${lessorId}`);
  revalidatePath("/lessors");
  revalidatePath("/cash", "layout");
  return { ok: true };
}

/** Yozuvni bekor qilish (o'chirilmaydi): qarz va kassa qoldig'i qaytadi, tarix saqlanadi. */
export async function cancelLessorEntry(id: string): Promise<FormState> {
  const { user, orgId } = await editor();
  const e = await db.lessorEntry.findFirst({ where: { id, orgId, status: "ACTIVE" } });
  if (!e) throw new ForbiddenError();
  await db.lessorEntry.update({ where: { id }, data: { status: "ARCHIVED" } });
  await audit({ actorId: user.id, orgId, action: "lessor.entry_cancel", entity: "LessorEntry", entityId: id });
  revalidatePath(`/lessors/${e.lessorId}`);
  revalidatePath("/lessors");
  revalidatePath("/cash", "layout");
  return { ok: true };
}
