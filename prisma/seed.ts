import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { normalizePhone } from "../src/lib/phone";

const db = new PrismaClient();

async function main() {
  const phone = normalizePhone(process.env.SEED_ADMIN_PHONE ?? "");
  const password = process.env.SEED_ADMIN_PASSWORD ?? "";
  if (!phone || password.length < 8) {
    throw new Error("SEED_ADMIN_PHONE va SEED_ADMIN_PASSWORD (kamida 8 belgi) berilishi kerak");
  }
  // Takroriy ishga tushirilsa, mavjud foydalanuvchi o'zgartirilmaydi.
  const existing = await db.user.findUnique({ where: { phone } });
  if (existing) {
    console.log(`Super Admin allaqachon bor: ${phone}`);
  } else {
    await db.user.create({
      data: { phone, fullName: "Super Admin", role: "SUPER_ADMIN", passwordHash: await hashPassword(password) },
    });
    console.log(`Super Admin yaratildi: ${phone}`);
  }

  if (process.env.SEED_DEMO === "1" && (await db.organization.count()) === 0) {
    const org = await db.organization.create({ data: { name: "Namuna Trans MChJ", inn: "300000000" } });
    const demoHash = await hashPassword(password);
    const demo = [
      { phone: "+998900000001", fullName: "Menejer Namuna", role: "MANAGER" as const, orgId: org.id },
      { phone: "+998900000002", fullName: "Rahbar Namuna", role: "DIRECTOR" as const, orgId: org.id },
      { phone: "+998900000003", fullName: "Buxgalter Namuna", role: "ACCOUNTANT" as const, orgId: null },
    ];
    for (const u of demo) await db.user.create({ data: { ...u, passwordHash: demoHash } });
    console.log("Namuna tashkilot va 3 foydalanuvchi yaratildi (parol Super Admin bilan bir xil).");
  }
}

main().finally(() => db.$disconnect());
