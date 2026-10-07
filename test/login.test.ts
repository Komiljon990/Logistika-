// Haqiqiy bazada ishlaydi (DATABASE_URL). Har test o'z foydalanuvchisini yaratib o'chiradi.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { checkLogin, MAX_FAILED_LOGINS } from "@/lib/login";
import { hashPassword } from "@/lib/password";

const PHONE = "+998999990001";
const PASSWORD = "correct-horse";
let orgId: string;

beforeAll(async () => {
  await db.user.deleteMany({ where: { phone: PHONE } });
  orgId = (await db.organization.create({ data: { name: "Login test org" } })).id;
  await db.user.create({
    data: { phone: PHONE, fullName: "T", role: "MANAGER", orgId, passwordHash: await hashPassword(PASSWORD) },
  });
});

afterAll(async () => {
  await db.user.deleteMany({ where: { phone: PHONE } });
  await db.organization.delete({ where: { id: orgId } });
  await db.$disconnect();
});

describe("checkLogin", () => {
  it("accepts the right password in any phone format", async () => {
    expect((await checkLogin("99 999 00 01", PASSWORD)).ok).toBe(true);
  });
  it("rejects a wrong password and an unknown phone the same way", async () => {
    expect(await checkLogin(PHONE, "wrong")).toEqual({ ok: false, error: "invalid" });
    expect(await checkLogin("+998911111111", "wrong")).toEqual({ ok: false, error: "invalid" });
  });
  it("locks after repeated failures, even for the right password", async () => {
    await db.user.update({ where: { phone: PHONE }, data: { failedLogins: 0, lockedUntil: null } });
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) await checkLogin(PHONE, "wrong");
    expect(await checkLogin(PHONE, PASSWORD)).toEqual({ ok: false, error: "locked" });
    await db.user.update({ where: { phone: PHONE }, data: { lockedUntil: null } });
  });
  it("refuses a user whose organization is blocked", async () => {
    await db.organization.update({ where: { id: orgId }, data: { status: "BLOCKED" } });
    expect(await checkLogin(PHONE, PASSWORD)).toEqual({ ok: false, error: "blocked" });
    await db.organization.update({ where: { id: orgId }, data: { status: "ACTIVE" } });
  });
});
