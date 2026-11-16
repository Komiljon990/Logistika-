/**
 * 16.11.2026: foydalanuvchilarni yangi "kirish hisobi" (Account) tizimiga ko'chirish. Qayta ishga tushirsa bo'ladi.
 *   npx tsx scripts/migrate-accounts.ts            — ko'chirish (parollar saqlanadi, telefon bilan kirish ishlayveradi)
 *   npx tsx scripts/migrate-accounts.ts --finalize — eski a'zolik ustunidagi parol nusxalarini tozalash (yangi versiya ishga tushgach)
 *
 * - Har bir User uchun telefon bo'yicha Account topiladi yoki yaratiladi (parol, bloklash holati ko'chiriladi).
 * - "Barcha tashkilotlar" buxgalterlari (tashkilotsiz ACCOUNTANT) yagona haqiqiy tashkilotga biriktiriladi
 *   (foydalanuvchi qarori: Andalus Trans MChJ). Bir nechta tashkilot bo'lsa — tegilmaydi, ogohlantiriladi.
 * - Demo tashkilot (demo a'zolari bor) isDemo deb belgilanadi.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  if (process.argv.includes("--finalize")) {
    const r = await db.user.updateMany({ where: { passwordHash: { not: null } }, data: { passwordHash: null, failedLogins: 0, lockedUntil: null } });
    console.log(`Eski parol nusxalari tozalandi: ${r.count}`);
    return;
  }

  const demoOrgs = await db.user.findMany({ where: { isDemo: true, orgId: { not: null } }, select: { orgId: true }, distinct: ["orgId"] });
  for (const { orgId } of demoOrgs) await db.organization.update({ where: { id: orgId! }, data: { isDemo: true } });
  console.log(`Demo tashkilot belgilandi: ${demoOrgs.length}`);

  // accountId endi majburiy; bo'sh qolganlari (sxema yangilanishidan oldin) xom so'rov bilan topiladi.
  const pending = await db.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE "accountId" IS NULL`;
  const users = await db.user.findMany({ where: { id: { in: pending.map((r) => r.id) } }, orderBy: { createdAt: "asc" } });
  for (const u of users) {
    let account = u.phone ? await db.account.findUnique({ where: { phone: u.phone } }) : null;
    if (!account) {
      account = await db.account.create({
        data: {
          phone: u.phone || null,
          email: u.email?.toLowerCase() || null,
          passwordHash: u.passwordHash,
          sessionVersion: u.sessionVersion,
          failedLogins: u.failedLogins,
          lockedUntil: u.lockedUntil,
          lastLoginAt: u.lastLoginAt,
          isDemo: u.isDemo,
        },
      });
    }
    await db.user.update({ where: { id: u.id }, data: { accountId: account.id } });
    console.log(`  ${u.fullName} (${u.role}) → hisob ${account.id}`);
  }
  console.log(`Ko'chirildi: ${users.length}`);

  const realOrgs = await db.organization.findMany({ where: { isDemo: false, status: "ACTIVE" }, select: { id: true, name: true } });
  const orphans = await db.user.findMany({ where: { orgId: null, role: { not: "SUPER_ADMIN" } } });
  if (orphans.length && realOrgs.length === 1) {
    const org = realOrgs[0];
    for (const u of orphans) {
      const dup = await db.user.findFirst({ where: { accountId: u.accountId, orgId: org.id } });
      if (dup) {
        await db.user.update({ where: { id: u.id }, data: { status: "ARCHIVED" } });
        console.log(`  ${u.fullName}: ${org.name}da allaqachon bor, eski yozuv arxivlandi`);
      } else {
        await db.user.update({ where: { id: u.id }, data: { orgId: org.id, sessionVersion: { increment: 1 } } });
        console.log(`  ${u.fullName} → ${org.name}`);
      }
    }
  } else if (orphans.length) {
    console.log(`DIQQAT: tashkilotsiz ${orphans.length} ta foydalanuvchi qoldi (haqiqiy tashkilotlar: ${realOrgs.length}). Ular kira olmaydi — rahbar qayta qo'shishi kerak.`);
  }
}

main().finally(() => db.$disconnect());
