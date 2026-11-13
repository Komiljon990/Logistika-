"use server";

import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertWritable, requireUser } from "@/lib/session";
import { canResetPassword } from "@/lib/roles";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/password";
import type { Dict } from "@/i18n";

export type PasswordState = { error?: keyof Dict; ok?: boolean };

/** Parolni qo'lda o'rnatish. Ruxsat har safar serverda bazadagi joriy rol va tashkilot bo'yicha tekshiriladi. */
export async function resetPassword(id: string, _prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const actor = await requireUser();
  await assertWritable(actor);
  const target = await db.user.findUnique({ where: { id }, select: { id: true, role: true, orgId: true } });
  if (!target || !canResetPassword(actor, target)) return { error: "user.error.forbidden" };

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("passwordConfirm") ?? "");
  if (password.length < MIN_PASSWORD_LENGTH) return { error: "user.error.password" };
  if (password !== confirm) return { error: "user.error.passwordMismatch" };

  await db.user.update({
    where: { id },
    data: {
      passwordHash: await hashPassword(password),
      sessionVersion: { increment: 1 },
      failedLogins: 0,
      lockedUntil: null,
    },
  });
  await audit({
    actorId: actor.id,
    orgId: target.orgId,
    action: "user.password_reset",
    entity: "User",
    entityId: id,
    details: { byRole: actor.role },
  });
  return { ok: true };
}
