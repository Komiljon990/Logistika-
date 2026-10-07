import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";
import { db } from "./db";
import { can, type Permission } from "./roles";

const COOKIE = "session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET kamida 32 belgi bo'lishi kerak");
  return new TextEncoder().encode(s);
}

export type CurrentUser = {
  id: string;
  fullName: string;
  phone: string;
  role: Role;
  orgId: string | null;
  orgName: string | null;
};

export async function createSession(userId: string, sessionVersion: number) {
  const token = await new SignJWT({ v: sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

/**
 * Har so'rovda foydalanuvchi bazadan qayta tekshiriladi: bloklangan foydalanuvchi, bloklangan tashkilot
 * yoki paroli almashtirilgan (sessionVersion o'zgargan) sessiya darhol ishlamay qoladi.
 * Har kim alohida login bilan kiradi, sessiyalar bir-biriga bog'lanmaydi.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  let payload;
  try {
    ({ payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] }));
  } catch {
    return null;
  }
  if (!payload.sub) return null;
  const user = await db.user.findUnique({ where: { id: payload.sub }, include: { org: true } });
  if (!user || user.status !== "ACTIVE" || user.sessionVersion !== payload.v) return null;
  if (user.org && user.org.status !== "ACTIVE") return null;
  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    orgId: user.orgId,
    orgName: user.org?.name ?? null,
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) redirect("/");
  return user;
}
