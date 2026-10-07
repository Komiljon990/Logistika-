"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma, type Role, type Status } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { isGlobalRole } from "@/lib/roles";
import { normalizePhone } from "@/lib/phone";
import { generatePassword, hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/password";
import type { Dict } from "@/i18n";

export type FormState = { error?: keyof Dict; ok?: boolean; newPassword?: string; values?: Record<string, string> };

/** React forma xatodan keyin tozalanadi; kiritilgan qiymatlar (parolsiz) qaytarilib qayta to'ldiriladi. */
function fail(error: keyof Dict, formData: FormData): FormState {
  const values: Record<string, string> = {};
  for (const [k, v] of formData) if (typeof v === "string" && k !== "password" && !k.startsWith("$")) values[k] = v;
  return { error, values };
}

const ROLES = ["SUPER_ADMIN", "ACCOUNTANT", "MANAGER", "DIRECTOR", "DEPUTY"] as const satisfies readonly Role[];
const STATUSES = ["ACTIVE", "BLOCKED", "ARCHIVED"] as const satisfies readonly Status[];

const optional = z.string().trim().max(300).transform((v) => v || null);

const orgSchema = z.object({
  name: z.string().trim().min(1).max(200),
  inn: optional,
  phone: optional,
  address: optional,
});

function orgData(formData: FormData) {
  return orgSchema.safeParse({
    name: formData.get("name") ?? "",
    inn: formData.get("inn") ?? "",
    phone: formData.get("phone") ?? "",
    address: formData.get("address") ?? "",
  });
}

export async function createOrg(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requirePermission("org.manage");
  const parsed = orgData(formData);
  if (!parsed.success) return fail("common.required", formData);
  const org = await db.organization.create({ data: parsed.data });
  await audit({ actorId: admin.id, orgId: org.id, action: "org.create", entity: "Organization", entityId: org.id });
  redirect(`/admin/orgs/${org.id}`);
}

export async function updateOrg(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requirePermission("org.manage");
  const parsed = orgData(formData);
  if (!parsed.success) return fail("common.required", formData);
  await db.organization.update({ where: { id }, data: parsed.data });
  await audit({ actorId: admin.id, orgId: id, action: "org.update", entity: "Organization", entityId: id, details: parsed.data });
  revalidatePath("/admin/orgs");
  return { ok: true };
}

export async function setOrgStatus(id: string, status: Status) {
  const admin = await requirePermission("org.manage");
  if (!STATUSES.includes(status)) return;
  await db.organization.update({ where: { id }, data: { status } });
  await audit({ actorId: admin.id, orgId: id, action: "org.status", entity: "Organization", entityId: id, details: { status } });
  revalidatePath(`/admin/orgs/${id}`);
}

const userSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  phone: z.string(),
  role: z.enum(ROLES),
  orgId: z.string().transform((v) => v || null),
});

type UserInput = { fullName: string; phone: string; role: Role; orgId: string | null };

async function validateUser(formData: FormData): Promise<{ data: UserInput } | { error: keyof Dict }> {
  const parsed = userSchema.safeParse({
    fullName: formData.get("fullName") ?? "",
    phone: formData.get("phone") ?? "",
    role: formData.get("role"),
    orgId: formData.get("orgId") ?? "",
  });
  if (!parsed.success) return { error: "common.required" };
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return { error: "user.error.phone" };
  // Super Admin va Buxgalter tashkilotga bog'lanmaydi; qolgan rollarga tashkilot majburiy.
  const orgId = isGlobalRole(parsed.data.role) ? null : parsed.data.orgId;
  if (!isGlobalRole(parsed.data.role)) {
    if (!orgId || !(await db.organization.findUnique({ where: { id: orgId } }))) return { error: "user.error.org" };
  }
  return { data: { ...parsed.data, phone, orgId } };
}

function isUniqueViolation(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

export async function createUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requirePermission("user.manage");
  const v = await validateUser(formData);
  if ("error" in v) return fail(v.error, formData);
  const password = String(formData.get("password") ?? "");
  if (password.length < MIN_PASSWORD_LENGTH) return fail("user.error.password", formData);
  let id: string;
  try {
    ({ id } = await db.user.create({ data: { ...v.data, passwordHash: await hashPassword(password) } }));
  } catch (e) {
    if (isUniqueViolation(e)) return fail("user.error.phoneTaken", formData);
    throw e;
  }
  await audit({
    actorId: admin.id,
    orgId: v.data.orgId,
    action: "user.create",
    entity: "User",
    entityId: id,
    details: { role: v.data.role, phone: v.data.phone },
  });
  redirect(`/admin/users/${id}`);
}

export async function updateUser(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requirePermission("user.manage");
  const v = await validateUser(formData);
  if ("error" in v) return fail(v.error, formData);
  // O'z rolini o'zgartirib, tizimni Super Adminsiz qoldirmaslik uchun.
  if (id === admin.id && v.data.role !== "SUPER_ADMIN") return fail("user.error.self", formData);
  const before = await db.user.findUniqueOrThrow({ where: { id } });
  try {
    await db.user.update({
      where: { id },
      data: {
        ...v.data,
        // Rol yoki tashkilot o'zgarsa, eski sessiyalar bekor bo'ladi.
        ...(before.role !== v.data.role || before.orgId !== v.data.orgId ? { sessionVersion: { increment: 1 } } : {}),
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) return fail("user.error.phoneTaken", formData);
    throw e;
  }
  await audit({
    actorId: admin.id,
    orgId: v.data.orgId,
    action: "user.update",
    entity: "User",
    entityId: id,
    details: { from: { role: before.role, orgId: before.orgId, phone: before.phone }, to: v.data },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setUserStatus(id: string, status: Status): Promise<FormState> {
  const admin = await requirePermission("user.manage");
  if (!STATUSES.includes(status)) return {};
  if (id === admin.id) return { error: "user.error.self" };
  const user = await db.user.update({ where: { id }, data: { status, sessionVersion: { increment: 1 } } });
  await audit({ actorId: admin.id, orgId: user.orgId, action: "user.status", entity: "User", entityId: id, details: { status } });
  revalidatePath(`/admin/users/${id}`);
  return { ok: true };
}

export async function resetPassword(id: string): Promise<FormState> {
  const admin = await requirePermission("user.manage");
  const newPassword = generatePassword();
  const user = await db.user.update({
    where: { id },
    data: {
      passwordHash: await hashPassword(newPassword),
      sessionVersion: { increment: 1 },
      failedLogins: 0,
      lockedUntil: null,
    },
  });
  await audit({ actorId: admin.id, orgId: user.orgId, action: "user.password_reset", entity: "User", entityId: id });
  return { ok: true, newPassword };
}
