"use server";

import { revalidatePath } from "next/cache";
import type { AccessMode } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertWritable, reissueSession, requireOwner } from "@/lib/session";
import { consumeCode, issueCode } from "@/lib/accounts";
import { generateTempPassword, GRANT_HOURS, normalizeEmail } from "@/lib/auth-core";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "@/lib/password";
import { unlinkStaff } from "@/lib/telegram-staff";
import type { Dict } from "@/i18n";

export type AccState = { error?: keyof Dict; ok?: boolean };

/** O'z parolini almashtirish (joriy parol bilan). Boshqa qurilmalardagi sessiyalar yopiladi. */
export async function changePassword(_prev: AccState, formData: FormData): Promise<AccState> {
  const user = await requireOwner();
  await assertWritable(user);
  const account = await db.account.findUniqueOrThrow({ where: { id: user.accountId } });
  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!account.passwordHash || !(await verifyPassword(current, account.passwordHash))) return { error: "acc.error.current" };
  if (password.length < MIN_PASSWORD_LENGTH) return { error: "user.error.password" };
  if (password !== String(formData.get("passwordConfirm") ?? "")) return { error: "user.error.passwordMismatch" };
  await db.account.update({ where: { id: account.id }, data: { passwordHash: await hashPassword(password), sessionVersion: { increment: 1 } } });
  await reissueSession(user);
  await audit({ actorId: user.id, orgId: user.orgId, action: "account.password_change", entity: "Account", entityId: account.id });
  return { ok: true };
}

export type EmailState = { step?: "code"; email?: string; error?: keyof Dict; ok?: boolean };

/** E-mailni qo'shish/almashtirish: yangi manzilga kod boradi, tasdiqlangach yoziladi. */
export async function requestEmailChange(_prev: EmailState, formData: FormData): Promise<EmailState> {
  const user = await requireOwner();
  await assertWritable(user);
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email) return { error: "code.error.email" };
  const taken = await db.account.findUnique({ where: { email } });
  if (taken && taken.id !== user.accountId) return { error: "acc.error.emailTaken" };
  if (taken) return { error: "acc.error.emailSame" };
  if (!(await issueCode(user.accountId, email, "EMAIL"))) return { step: "code", email, error: "acc.error.tooOften" };
  return { step: "code", email };
}

export async function confirmEmailChange(_prev: EmailState, formData: FormData): Promise<EmailState> {
  const user = await requireOwner();
  await assertWritable(user);
  const ok = await consumeCode(user.accountId, "EMAIL", String(formData.get("code") ?? ""));
  const email = String(formData.get("email") ?? "");
  if (!ok) return { step: "code", email, error: "code.error.code" };
  if (await db.account.findFirst({ where: { email: ok.email, NOT: { id: user.accountId } } })) return { error: "acc.error.emailTaken" };
  await db.account.update({ where: { id: user.accountId }, data: { email: ok.email } });
  await db.user.updateMany({ where: { accountId: user.accountId }, data: { email: ok.email } });
  await audit({ actorId: user.id, orgId: user.orgId, action: "account.email_change", entity: "Account", entityId: user.accountId });
  revalidatePath("/account");
  return { ok: true };
}

export type GrantState = { error?: keyof Dict; password?: string; mode?: AccessMode; expiresAt?: string };

/**
 * Vaqtincha parol: foydalanuvchining o'zi yaratadi va yordam beruvchiga beradi. Bir vaqtda bittasi faol —
 * yangisi yaratilsa eskisi to'xtatiladi. Parol faqat shu yerda bir marta ko'rsatiladi (bazada xeshi saqlanadi).
 */
export async function createGrant(_prev: GrantState, formData: FormData): Promise<GrantState> {
  const user = await requireOwner();
  await assertWritable(user);
  const mode = formData.get("mode") === "EDIT" ? "EDIT" : formData.get("mode") === "VIEW" ? "VIEW" : null;
  const hours = Number(formData.get("hours"));
  if (!mode || !(GRANT_HOURS as readonly number[]).includes(hours)) return { error: "common.required" };
  const now = new Date();
  const password = generateTempPassword();
  const expiresAt = new Date(now.getTime() + hours * 3_600_000);
  await db.accessGrant.updateMany({ where: { accountId: user.accountId, revokedAt: null }, data: { revokedAt: now } });
  const grant = await db.accessGrant.create({ data: { accountId: user.accountId, mode, expiresAt, passwordHash: await hashPassword(password) } });
  await audit({ actorId: user.id, orgId: user.orgId, action: "account.grant_create", entity: "Account", entityId: user.accountId, details: { grantId: grant.id, mode, hours } });
  revalidatePath("/account");
  return { password, mode, expiresAt: expiresAt.toISOString() };
}

/** Telegram botdan uzish (19.11.2026): shu hisobga bot boshqa xabar yubormaydi va ma'lumot ko'rsatmaydi. */
export async function unlinkTelegram(): Promise<void> {
  const user = await requireOwner();
  await assertWritable(user);
  await unlinkStaff(user.accountId);
  await audit({ actorId: user.id, orgId: user.orgId, action: "account.telegram_unlink", entity: "Account", entityId: user.accountId });
  revalidatePath("/account");
}

/** "To'xtatish": faol vaqtincha parol bekor qilinadi, u bilan ochilgan sessiyalar darhol yopiladi. */
export async function revokeGrants(): Promise<void> {
  const user = await requireOwner();
  await assertWritable(user);
  const r = await db.accessGrant.updateMany({ where: { accountId: user.accountId, revokedAt: null, expiresAt: { gt: new Date() } }, data: { revokedAt: new Date() } });
  if (r.count) await audit({ actorId: user.id, orgId: user.orgId, action: "account.grant_revoke", entity: "Account", entityId: user.accountId });
  revalidatePath("/account");
}
