import type { AccessMode } from "@prisma/client";
import { db } from "./db";
import { verifyPassword } from "./password";
import { canonicalTempPassword, parseIdentifier } from "./auth-core";

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

// Mavjud bo'lmagan login uchun ham bcrypt ishlaydi, javob vaqti bir xil bo'lishi uchun.
const DUMMY_HASH = "$2b$12$ueJrS6/sCGEi4FcZX1gkIOl7veWb/sE1wQuN4f3UinBYH4zjVRU8W";

export type LoginResult =
  | { ok: true; accountId: string; sessionVersion: number; grant: { id: string; mode: AccessMode } | null }
  | { ok: false; error: "invalid" | "locked" | "blocked" };

/** Faol a'zoliklar (faol tashkilotda yoki Super Admin). Demo tashkilot faqat demo hisobga ochiladi. */
export async function activeMemberships(accountId: string) {
  return db.user.findMany({
    where: { accountId, status: "ACTIVE", OR: [{ orgId: null, role: "SUPER_ADMIN" }, { org: { status: "ACTIVE" } }] },
    include: { org: { select: { name: true, isDemo: true } } },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Login: e-mail yoki telefon + parol. Parol mos kelmasa, foydalanuvchining o'zi yaratgan faol vaqtincha parol
 * tekshiriladi (shunda sessiya "vaqtincha kirish" deb belgilanadi). Noto'g'ri urinishlar hisobni 15 daqiqaga bloklaydi.
 */
export async function checkLogin(identifier: string, password: string, now = new Date()): Promise<LoginResult> {
  const id = parseIdentifier(identifier);
  const account = id ? await db.account.findUnique({ where: id }) : null;
  if (!account || !password) {
    await verifyPassword(password, DUMMY_HASH);
    return { ok: false, error: "invalid" };
  }
  if (!account.isDemo && account.lockedUntil && account.lockedUntil > now) return { ok: false, error: "locked" };

  let grant: { id: string; mode: AccessMode } | null = null;
  let valid = account.passwordHash ? await verifyPassword(password, account.passwordHash) : (await verifyPassword(password, DUMMY_HASH), false);
  if (!valid && !account.isDemo) {
    const temp = canonicalTempPassword(password);
    if (temp) {
      const grants = await db.accessGrant.findMany({ where: { accountId: account.id, revokedAt: null, expiresAt: { gt: now } } });
      for (const g of grants) {
        if (await verifyPassword(temp, g.passwordHash)) {
          grant = { id: g.id, mode: g.mode };
          valid = true;
          break;
        }
      }
    }
  }

  // Demo hisob ochiq: uni noto'g'ri parol bilan bloklab, reklamani ishdan chiqarib bo'lmaydi; bazaga hech narsa yozilmaydi.
  if (account.isDemo) {
    if (!valid) return { ok: false, error: "invalid" };
    if ((await activeMemberships(account.id)).length === 0) return { ok: false, error: "blocked" };
    return { ok: true, accountId: account.id, sessionVersion: account.sessionVersion, grant: null };
  }
  if (!valid) {
    const failed = account.failedLogins + 1;
    const lock = failed >= MAX_FAILED_LOGINS;
    await db.account.update({
      where: { id: account.id },
      data: { failedLogins: lock ? 0 : failed, lockedUntil: lock ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : account.lockedUntil },
    });
    return { ok: false, error: lock ? "locked" : "invalid" };
  }
  if ((await activeMemberships(account.id)).length === 0) return { ok: false, error: "blocked" };
  await db.account.update({ where: { id: account.id }, data: { failedLogins: 0, lockedUntil: null, ...(grant ? {} : { lastLoginAt: now }) } });
  if (grant) await db.accessGrant.update({ where: { id: grant.id }, data: { lastUsedAt: now } });
  return { ok: true, accountId: account.id, sessionVersion: account.sessionVersion, grant };
}
