import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { normalizePhone } from "../src/lib/phone";

const db = new PrismaClient();

/**
 * Birinchi Super Admin (telefon + parol bilan kiradi; keyin "Mening hisobim"da e-mail qo'shadi).
 * Tashkilot va rahbarlarni Super Admin tizim orqali qo'shadi, xodimlarni — rahbar.
 */
async function main() {
  const phone = normalizePhone(process.env.SEED_ADMIN_PHONE ?? "");
  const password = process.env.SEED_ADMIN_PASSWORD ?? "";
  if (!phone || password.length < 8) {
    throw new Error("SEED_ADMIN_PHONE va SEED_ADMIN_PASSWORD (kamida 8 belgi) berilishi kerak");
  }
  // Takroriy ishga tushirilsa, mavjud hisob o'zgartirilmaydi.
  const existing = await db.account.findUnique({ where: { phone } });
  if (existing) {
    console.log(`Hisob allaqachon bor: ${phone}`);
    return;
  }
  const account = await db.account.create({ data: { phone, passwordHash: await hashPassword(password) } });
  await db.user.create({ data: { accountId: account.id, phone, fullName: "Super Admin", role: "SUPER_ADMIN" } });
  console.log(`Super Admin yaratildi: ${phone}`);
}

main().finally(() => db.$disconnect());
