// Haqiqiy bazada ishlaydi (DATABASE_URL). Test o'z hisobi va tashkilotlarini yaratib o'chiradi.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { activeMemberships, checkLogin, MAX_FAILED_LOGINS } from "@/lib/login";
import { hashPassword } from "@/lib/password";

const PHONE = "+998999990001";
const EMAIL = "login-test@example.uz";
const PASSWORD = "correct-horse";
const TEMP = "ABCD-EFGH-JKMN";
let orgId: string;
let org2Id: string;
let accountId: string;

async function cleanup() {
  const acc = await db.account.findFirst({ where: { OR: [{ phone: PHONE }, { email: EMAIL }] } });
  if (acc) {
    await db.user.deleteMany({ where: { accountId: acc.id } });
    await db.account.delete({ where: { id: acc.id } });
  }
}

beforeAll(async () => {
  await cleanup();
  orgId = (await db.organization.create({ data: { name: "Login test org" } })).id;
  org2Id = (await db.organization.create({ data: { name: "Login test org 2" } })).id;
  accountId = (await db.account.create({ data: { phone: PHONE, email: EMAIL, passwordHash: await hashPassword(PASSWORD) } })).id;
  await db.user.create({ data: { accountId, phone: PHONE, fullName: "T", role: "MANAGER", orgId } });
});

afterAll(async () => {
  await cleanup();
  await db.organization.deleteMany({ where: { id: { in: [orgId, org2Id] } } });
  await db.$disconnect();
});

describe("checkLogin", () => {
  it("accepts the right password by phone (any format) or e-mail (any case)", async () => {
    expect((await checkLogin("99 999 00 01", PASSWORD)).ok).toBe(true);
    expect((await checkLogin("  Login-Test@Example.UZ ", PASSWORD)).ok).toBe(true);
  });
  it("rejects a wrong password and an unknown login the same way", async () => {
    expect(await checkLogin(PHONE, "wrong")).toEqual({ ok: false, error: "invalid" });
    expect(await checkLogin("+998911111111", "wrong")).toEqual({ ok: false, error: "invalid" });
    expect(await checkLogin("nobody@example.uz", "wrong")).toEqual({ ok: false, error: "invalid" });
  });
  it("locks after repeated failures, even for the right password", async () => {
    await db.account.update({ where: { id: accountId }, data: { failedLogins: 0, lockedUntil: null } });
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) await checkLogin(PHONE, "wrong");
    expect(await checkLogin(PHONE, PASSWORD)).toEqual({ ok: false, error: "locked" });
    await db.account.update({ where: { id: accountId }, data: { lockedUntil: null } });
  });
  it("refuses an account whose only organization is blocked", async () => {
    await db.organization.update({ where: { id: orgId }, data: { status: "BLOCKED" } });
    expect(await checkLogin(PHONE, PASSWORD)).toEqual({ ok: false, error: "blocked" });
    await db.organization.update({ where: { id: orgId }, data: { status: "ACTIVE" } });
  });
  it("refuses an account that has not set a password yet", async () => {
    const acc = await db.account.create({ data: { email: "nopass-test@example.uz" } });
    await db.user.create({ data: { accountId: acc.id, phone: "", fullName: "N", role: "MANAGER", orgId } });
    expect(await checkLogin("nopass-test@example.uz", "anything-here")).toEqual({ ok: false, error: "invalid" });
    await db.user.deleteMany({ where: { accountId: acc.id } });
    await db.account.delete({ where: { id: acc.id } });
  });
});

describe("one login, several organizations", () => {
  it("lists every active membership separately", async () => {
    await db.user.create({ data: { accountId, phone: PHONE, fullName: "T", role: "ACCOUNTANT", orgId: org2Id } });
    const m = await activeMemberships(accountId);
    expect(m.map((x) => x.orgId).sort()).toEqual([orgId, org2Id].sort());
    await db.organization.update({ where: { id: org2Id }, data: { status: "BLOCKED" } });
    expect((await activeMemberships(accountId)).map((x) => x.orgId)).toEqual([orgId]);
    await db.organization.update({ where: { id: org2Id }, data: { status: "ACTIVE" } });
  });
});

describe("temporary password", () => {
  it("logs in with an active grant and marks the session mode", async () => {
    const g = await db.accessGrant.create({ data: { accountId, mode: "VIEW", passwordHash: await hashPassword(TEMP), expiresAt: new Date(Date.now() + 3_600_000) } });
    const r = await checkLogin(EMAIL, "abcd efgh jkmn");
    expect(r).toMatchObject({ ok: true, grant: { id: g.id, mode: "VIEW" } });
    // Asosiy parol bilan kirish — oddiy sessiya.
    expect(await checkLogin(EMAIL, PASSWORD)).toMatchObject({ ok: true, grant: null });
  });
  it("stops working once revoked or expired", async () => {
    await db.accessGrant.updateMany({ where: { accountId }, data: { revokedAt: new Date() } });
    expect(await checkLogin(EMAIL, TEMP)).toEqual({ ok: false, error: "invalid" });
    await db.accessGrant.create({ data: { accountId, mode: "EDIT", passwordHash: await hashPassword(TEMP), expiresAt: new Date(Date.now() - 1000) } });
    expect(await checkLogin(EMAIL, TEMP)).toEqual({ ok: false, error: "invalid" });
    await db.account.update({ where: { id: accountId }, data: { failedLogins: 0 } });
  });
});
