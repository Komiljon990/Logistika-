"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getCurrentUser, reissueSession } from "@/lib/session";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "@/lib/password";
import { canonicalTempPassword } from "@/lib/auth-core";

export type SetPasswordState = { error?: "password" | "mismatch" | "same" };

/** Vaqtincha parol bilan kirgan rahbar o'z parolini o'rnatadi. */
export async function setOwnPassword(_prev: SetPasswordState, formData: FormData): Promise<SetPasswordState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.mustChangePassword) redirect("/");
  const password = String(formData.get("password") ?? "");
  if (password.length < MIN_PASSWORD_LENGTH) return { error: "password" };
  if (password !== String(formData.get("passwordConfirm") ?? "")) return { error: "mismatch" };
  const account = await db.account.findUniqueOrThrow({ where: { id: user.accountId } });
  // Vaqtincha parolning o'zini doimiy parol qilib qoldirib bo'lmaydi.
  const temp = canonicalTempPassword(password);
  if (account.passwordHash && temp && (await verifyPassword(temp, account.passwordHash))) return { error: "same" };
  await db.account.update({
    where: { id: account.id },
    data: { passwordHash: await hashPassword(password), mustChangePassword: false, tempPasswordUntil: null, sessionVersion: { increment: 1 } },
  });
  await audit({ actorId: user.id, orgId: user.orgId, action: "account.password_set", entity: "Account", entityId: account.id, details: { via: "temp_password" } });
  await reissueSession({ ...user, mustChangePassword: false });
  redirect(user.memberships > 1 ? "/select-org" : "/");
}
