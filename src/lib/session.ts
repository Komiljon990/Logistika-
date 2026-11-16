import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import type { AccessMode, Role } from "@prisma/client";
import { db } from "./db";
import { can, type Permission } from "./roles";
import { activeMemberships } from "./login";

const COOKIE = "session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function sessionSecret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET kamida 32 belgi bo'lishi kerak");
  return new TextEncoder().encode(s);
}

export type CurrentUser = {
  /** Joriy tashkilotdagi a'zolik (User) id — barcha yozuvlarda "kim kiritdi" shu. */
  id: string;
  accountId: string;
  fullName: string;
  phone: string;
  /** Kirish hisobining e-maili (kod shu manzilga boradi). */
  email: string | null;
  role: Role;
  orgId: string | null;
  orgName: string | null;
  isDemo: boolean;
  /** Vaqtincha parol bilan kirilgan bo'lsa: kim kirganini bilmaymiz, faqat ruxsat turi va muddati. */
  grant: { id: string; mode: AccessMode; expiresAt: Date } | null;
  /** Hech narsa saqlay olmaydi: demo hisob yoki "faqat ko'rish" vaqtincha paroli. */
  readOnly: boolean;
  memberships: number;
};

/** Ma'lumotni o'zgartiradigan huquqlar: demo va "faqat ko'rish" sessiyasiga hech qachon berilmaydi. */
const WRITE_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
  "data.edit", "orgdoc.edit", "currency.manage", "vehicle.delete", "user.manage", "org.manage", "hard.delete",
  "cash.edit", "cash.settings", "team.manage",
]);

/**
 * Faqat o'qish sessiyasi hech narsani saqlay olmaydi: amal bajarilmaydi, foydalanuvchi o'sha sahifaga
 * "?demo=readonly" belgisi bilan qaytariladi (sahifada tushuntirish chiqadi).
 */
export async function demoBlocked(): Promise<never> {
  let back = "/";
  const ref = (await headers()).get("referer");
  if (ref) {
    try {
      const u = new URL(ref);
      // Faqat yo'l olinadi (boshqa saytga yo'naltirish imkoni yo'q).
      u.searchParams.set("demo", "readonly");
      back = `${u.pathname}?${u.searchParams.toString()}`;
    } catch {
      back = "/";
    }
  }
  redirect(back.startsWith("/") && !back.startsWith("//") ? back : "/");
}

export async function assertWritable(user: CurrentUser) {
  if (user.readOnly) await demoBlocked();
}

type SessionClaims = { accountId: string; v: number; userId: string; mv: number; grantId: string | null };

async function writeCookie(c: SessionClaims) {
  const token = await new SignJWT({ v: c.v, m: c.userId, mv: c.mv, ...(c.grantId ? { g: c.grantId } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(c.accountId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(sessionSecret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    // COOKIE_SECURE="false" — HTTPS'siz lokal tarmoqdagi sinov serveri uchun.
    secure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/**
 * Login muvaffaqiyatli bo'lgach sessiya ochadi: oxirgi tanlangan tashkilot (bo'lmasa birinchisi).
 * `choose` — bir nechta tashkilot bor va hali tanlanmagan (tashkilot tanlash sahifasi ko'rsatiladi).
 */
export async function openSession(accountId: string, sessionVersion: number, grantId: string | null): Promise<{ choose: boolean } | null> {
  const [account, members] = await Promise.all([
    db.account.findUniqueOrThrow({ where: { id: accountId }, select: { lastUserId: true } }),
    activeMemberships(accountId),
  ]);
  if (members.length === 0) return null;
  const remembered = members.find((m) => m.id === account.lastUserId);
  const pick = remembered ?? members[0];
  await writeCookie({ accountId, v: sessionVersion, userId: pick.id, mv: pick.sessionVersion, grantId });
  return { choose: members.length > 1 && !remembered };
}

/** Boshqa tashkilotga o'tish: faqat shu hisobning faol a'zoligiga. */
export async function switchSession(user: CurrentUser, userId: string): Promise<boolean> {
  const members = await activeMemberships(user.accountId);
  const target = members.find((m) => m.id === userId);
  if (!target) return false;
  const account = await db.account.findUniqueOrThrow({ where: { id: user.accountId }, select: { sessionVersion: true } });
  await writeCookie({ accountId: user.accountId, v: account.sessionVersion, userId: target.id, mv: target.sessionVersion, grantId: user.grant?.id ?? null });
  if (!user.grant) await db.account.update({ where: { id: user.accountId }, data: { lastUserId: target.id } });
  return true;
}

/** Parol o'zgargach (hisob sessionVersion oshgach) shu qurilmadagi sessiyani yangilaydi; boshqa qurilmalar chiqib ketadi. */
export async function reissueSession(user: CurrentUser) {
  const member = await db.user.findUniqueOrThrow({ where: { id: user.id }, include: { account: { select: { sessionVersion: true } } } });
  await writeCookie({ accountId: user.accountId, v: member.account.sessionVersion, userId: member.id, mv: member.sessionVersion, grantId: user.grant?.id ?? null });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

/**
 * Har so'rovda sessiya bazadan qayta tekshiriladi: bloklangan a'zolik yoki tashkilot, almashtirilgan parol
 * (hisob sessionVersion), o'zgargan rol (a'zolik sessionVersion), to'xtatilgan yoki muddati o'tgan vaqtincha parol —
 * sessiya darhol ishlamay qoladi.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  let payload;
  try {
    ({ payload } = await jwtVerify(token, sessionSecret(), { algorithms: ["HS256"] }));
  } catch {
    return null;
  }
  const { sub, v, m, mv, g } = payload as { sub?: string; v?: number; m?: string; mv?: number; g?: string };
  if (!sub || typeof m !== "string") return null;
  const user = await db.user.findUnique({ where: { id: m }, include: { org: true, account: true } });
  if (!user || user.accountId !== sub || user.status !== "ACTIVE") return null;
  if (user.account.sessionVersion !== v || user.sessionVersion !== mv) return null;
  if (user.org ? user.org.status !== "ACTIVE" : user.role !== "SUPER_ADMIN") return null;
  const isDemo = user.isDemo || user.account.isDemo;
  // Himoya qatlami: demo hisob faqat demo tashkilotda ishlaydi.
  if (isDemo && !user.org?.isDemo) return null;

  let grant: CurrentUser["grant"] = null;
  if (g) {
    const row = await db.accessGrant.findUnique({ where: { id: g } });
    if (!row || row.accountId !== sub || row.revokedAt || row.expiresAt <= new Date()) return null;
    grant = { id: row.id, mode: row.mode, expiresAt: row.expiresAt };
  }
  const memberships = await db.user.count({
    where: { accountId: sub, status: "ACTIVE", OR: [{ orgId: null, role: "SUPER_ADMIN" }, { org: { status: "ACTIVE" } }] },
  });
  return {
    id: user.id,
    accountId: sub,
    fullName: user.fullName,
    phone: user.phone,
    email: user.account.email,
    role: user.role,
    orgId: user.orgId,
    orgName: user.org?.name ?? null,
    isDemo,
    grant,
    readOnly: isDemo || grant?.mode === "VIEW",
    memberships,
  };
}

/** Istalgan kirgan foydalanuvchi (Super Admin ham). */
export async function requireSession(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Tashkilot ma'lumotlari sahifalari: faqat tashkilot a'zosi. Super Admin tashkilot ma'lumotlarini ko'rmaydi
 * (16.11.2026) — boshqaruv bo'limiga yo'naltiriladi.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await requireSession();
  if (!user.orgId) redirect("/admin/orgs");
  return user;
}

/** Hisob xavfsizligi (parol, e-mail, vaqtincha parollar): faqat egasi — vaqtincha parol bilan kirgan emas. */
export async function requireOwner(): Promise<CurrentUser> {
  const user = await requireSession();
  if (user.grant) redirect("/account");
  return user;
}

export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireSession();
  if (!can(user.role, permission)) redirect("/");
  // Faqat o'qish sessiyasi sahifalarni (formalar bilan) ko'radi, lekin saqlash amali (server action) bajarilmaydi.
  if (WRITE_PERMISSIONS.has(permission) && user.readOnly && (await headers()).has("next-action")) await demoBlocked();
  return user;
}
