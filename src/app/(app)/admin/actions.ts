"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Status } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { normalizePhone } from "@/lib/phone";
import { normalizeEmail } from "@/lib/auth-core";
import { fail, type FormState } from "@/lib/form";
import { seedOrgCurrencies } from "@/lib/org-currency";
import { addMembership, parseMember, resendInviteFor } from "@/lib/members";

export type { FormState };

/*
 * Super Admin (16.11.2026): faqat tashkilot va uning rahbarini kiritadi, bloklaydi. Tashkilot ma'lumotlarini
 * ko'rmaydi, hech kimning parolini tiklamaydi. Xodimlarni (menejer, buxgalter, vakil) rahbar qo'shadi.
 */

const optional = z.string().trim().max(300).transform((v) => v || null);
const orgSchema = z.object({ name: z.string().trim().min(1).max(200), inn: optional, address: optional });

type OrgData = { name: string; inn: string | null; address: string | null; phone: string | null; email: string };

function orgData(formData: FormData): { data: OrgData } | { error: "common.required" | "user.error.phone" | "code.error.email" } {
  const parsed = orgSchema.safeParse({ name: formData.get("name") ?? "", inn: formData.get("inn") ?? "", address: formData.get("address") ?? "" });
  if (!parsed.success) return { error: "common.required" as const };
  const rawPhone = String(formData.get("phone") ?? "").trim();
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (rawPhone && !phone) return { error: "user.error.phone" as const };
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email) return { error: "code.error.email" as const };
  return { data: { ...parsed.data, phone, email } };
}

/** Yangi tashkilot + rahbar: nomi, STIR, e-mail va telefon; rahbar F.I.O.si. Rahbarga taklifnoma boradi. */
export async function createOrg(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requirePermission("org.manage");
  const o = orgData(formData);
  if ("error" in o) return fail(o.error, formData);
  const m = parseMember(formData);
  if ("error" in m) return fail(m.error, formData);
  const org = await db.organization.create({ data: o.data });
  await seedOrgCurrencies(org.id);
  await audit({ actorId: admin.id, orgId: org.id, action: "org.create", entity: "Organization", entityId: org.id });
  const res = await addMembership({ orgId: org.id, role: "DIRECTOR", input: m.data, actorId: admin.id, formData });
  if (!res.ok) {
    // Rahbar qo'shilmasa, bo'sh tashkilot qolmasin.
    await db.orgCurrency.deleteMany({ where: { orgId: org.id } });
    await db.auditLog.deleteMany({ where: { orgId: org.id } });
    await db.organization.delete({ where: { id: org.id } });
    return res;
  }
  redirect(`/admin/orgs/${org.id}?created=1`);
}

async function realOrg(id: string) {
  const org = await db.organization.findUnique({ where: { id } });
  return org && !org.isDemo ? org : null;
}

export async function updateOrg(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requirePermission("org.manage");
  if (!(await realOrg(id))) return { error: "user.error.org" };
  const o = orgData(formData);
  if ("error" in o) return fail(o.error, formData);
  await db.organization.update({ where: { id }, data: o.data });
  await audit({ actorId: admin.id, orgId: id, action: "org.update", entity: "Organization", entityId: id, details: o.data });
  revalidatePath(`/admin/orgs/${id}`);
  return { ok: true };
}

export async function setOrgStatus(id: string, status: Status) {
  const admin = await requirePermission("org.manage");
  if (!["ACTIVE", "BLOCKED"].includes(status) || !(await realOrg(id))) return;
  await db.organization.update({ where: { id }, data: { status } });
  await audit({ actorId: admin.id, orgId: id, action: "org.status", entity: "Organization", entityId: id, details: { status } });
  revalidatePath(`/admin/orgs/${id}`);
}

/** Rahbar almashsa yoki ikkinchi rahbar kerak bo'lsa. */
export async function addDirector(orgId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requirePermission("user.manage");
  const m = parseMember(formData);
  if ("error" in m) return fail(m.error, formData);
  const res = await addMembership({ orgId, role: "DIRECTOR", input: m.data, actorId: admin.id, formData });
  if (res.ok) revalidatePath(`/admin/orgs/${orgId}`);
  return res.ok ? { ok: true } : res;
}

async function directorRow(userId: string) {
  const u = await db.user.findUnique({ where: { id: userId }, include: { org: true } });
  return u && u.role === "DIRECTOR" && u.org && !u.org.isDemo ? u : null;
}

export async function setDirectorStatus(userId: string, active: boolean) {
  const admin = await requirePermission("user.manage");
  const u = await directorRow(userId);
  if (!u) return;
  await db.user.update({ where: { id: userId }, data: { status: active ? "ACTIVE" : "BLOCKED", sessionVersion: { increment: 1 } } });
  await audit({ actorId: admin.id, orgId: u.orgId, action: "team.status", entity: "User", entityId: userId, details: { status: active ? "ACTIVE" : "BLOCKED" } });
  revalidatePath(`/admin/orgs/${u.orgId}`);
}

export async function resendDirectorInvite(userId: string, _prev: FormState): Promise<FormState> {
  await requirePermission("user.manage");
  if (!(await directorRow(userId))) return { error: "user.error.forbidden" };
  return (await resendInviteFor(userId)) ? { ok: true } : { error: "user.error.forbidden" };
}
