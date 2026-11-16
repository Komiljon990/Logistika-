"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { checkLogin, activeMemberships } from "@/lib/login";
import { openSession } from "@/lib/session";
import { consumeCode, issueCode } from "@/lib/accounts";
import { normalizeEmail } from "@/lib/auth-core";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/password";

export type LoginState = { error?: "invalid" | "locked" | "blocked" };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const identifier = String(formData.get("login") ?? formData.get("phone") ?? "");
  const password = String(formData.get("password") ?? "");
  const result = await checkLogin(identifier, password);
  if (!result.ok) return { error: result.error };
  const opened = await openSession(result.accountId, result.sessionVersion, result.grant?.id ?? null);
  if (!opened) return { error: "blocked" };
  if (result.grant) {
    await audit({ actorId: null, action: "account.grant_login", entity: "Account", entityId: result.accountId, details: { grantId: result.grant.id, mode: result.grant.mode } });
  }
  redirect(opened.choose ? "/select-org" : "/");
}

export type CodeState = {
  step?: "code";
  email?: string;
  error?: "email" | "code" | "password" | "mismatch" | "blocked";
};

/**
 * 1-qadam: e-mailga kod. Javob har doim bir xil ("yuborildi") — tizimda qaysi e-mail borligini bilib bo'lmaydi.
 * Kod faqat faol a'zoligi bor, demo bo'lmagan hisobga yuboriladi.
 */
export async function requestCode(_prev: CodeState, formData: FormData): Promise<CodeState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email) return { error: "email" };
  const account = await db.account.findUnique({ where: { email } });
  if (account && !account.isDemo && (await activeMemberships(account.id)).length > 0) {
    await issueCode(account.id, email, "RESET");
  }
  return { step: "code", email };
}

/** 2-qadam: kod + yangi parol. Parol o'rnatilgach eski sessiyalar bekor bo'ladi va foydalanuvchi kiradi. */
export async function resetWithCode(_prev: CodeState, formData: FormData): Promise<CodeState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email) return { error: "email" };
  const code = String(formData.get("code") ?? "");
  const password = String(formData.get("password") ?? "");
  const back = { step: "code" as const, email };
  if (password.length < MIN_PASSWORD_LENGTH) return { ...back, error: "password" };
  if (password !== String(formData.get("passwordConfirm") ?? "")) return { ...back, error: "mismatch" };

  const account = await db.account.findUnique({ where: { email } });
  if (!account || account.isDemo || !(await consumeCode(account.id, "RESET", code))) return { ...back, error: "code" };
  const updated = await db.account.update({
    where: { id: account.id },
    data: { passwordHash: await hashPassword(password), sessionVersion: { increment: 1 }, failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await audit({ actorId: null, action: "account.password_set", entity: "Account", entityId: account.id, details: { via: "email_code" } });
  const opened = await openSession(account.id, updated.sessionVersion, null);
  if (!opened) return { ...back, error: "blocked" };
  redirect(opened.choose ? "/select-org" : "/");
}
