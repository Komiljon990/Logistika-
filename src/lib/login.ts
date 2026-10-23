import { db } from "./db";
import { normalizePhone } from "./phone";
import { verifyPassword } from "./password";

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

// Mavjud bo'lmagan raqam uchun ham bcrypt ishlaydi, javob vaqti bir xil bo'lishi uchun.
const DUMMY_HASH = "$2b$12$ueJrS6/sCGEi4FcZX1gkIOl7veWb/sE1wQuN4f3UinBYH4zjVRU8W";

export type LoginResult =
  | { ok: true; userId: string; sessionVersion: number }
  | { ok: false; error: "invalid" | "locked" | "blocked" };

export async function checkLogin(phoneInput: string, password: string, now = new Date()): Promise<LoginResult> {
  const phone = normalizePhone(phoneInput);
  const user = phone ? await db.user.findUnique({ where: { phone }, include: { org: true } }) : null;
  if (!user) {
    await verifyPassword(password, DUMMY_HASH);
    return { ok: false, error: "invalid" };
  }
  if (user.lockedUntil && user.lockedUntil > now) return { ok: false, error: "locked" };

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const failed = user.failedLogins + 1;
    const lock = failed >= MAX_FAILED_LOGINS;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLogins: lock ? 0 : failed,
        lockedUntil: lock ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : user.lockedUntil,
      },
    });
    return { ok: false, error: lock ? "locked" : "invalid" };
  }
  if (user.status !== "ACTIVE" || (user.org && user.org.status !== "ACTIVE")) {
    return { ok: false, error: "blocked" };
  }
  await db.user.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: now },
  });
  return { ok: true, userId: user.id, sessionVersion: user.sessionVersion };
}
