import "server-only";
import type { Role } from "@prisma/client";
import { db } from "./db";
import { appUrl, mailHtml, senderAddress, sendMail } from "./mailer";
import { canSendCode, CODE_TTL_MINUTES, codeMatches, generateCode, hashCode, MAX_CODE_ATTEMPTS } from "./auth-core";

function codeSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET kamida 32 belgi bo'lishi kerak");
  return `login-code:${s}`;
}

export type LinkResult = { accountId: string; isNew: boolean; hasPassword: boolean } | { error: "user.error.emailDemo" };

/**
 * A'zolik qo'shilganda kirish hisobini topadi yoki yaratadi. Shaxs e-mail bo'yicha aniqlanadi.
 * Xavfsizlik: mavjud hisobning e-mail/telefoni hech qachon o'zgartirilmaydi (aks holda rahbar o'z telefonini
 * birovning hisobiga qo'shib, uni egallab olishi mumkin edi) — faqat a'zolik bog'lanadi.
 */
export async function linkAccount(email: string, phone: string | null): Promise<LinkResult> {
  const existing = await db.account.findUnique({ where: { email } });
  if (existing) {
    if (existing.isDemo) return { error: "user.error.emailDemo" };
    return { accountId: existing.id, isNew: false, hasPassword: !!existing.passwordHash };
  }
  // Telefon boshqa hisobda band bo'lsa, yangi hisobga yozilmaydi (login sifatida bir xil bo'lmasligi uchun).
  const phoneFree = phone ? !(await db.account.findUnique({ where: { phone } })) : false;
  const account = await db.account.create({ data: { email, phone: phoneFree ? phone : null } });
  return { accountId: account.id, isNew: true, hasPassword: false };
}

/** Taklifnoma: tashkilotga qo'shilgani va qanday kirish haqida (kod emas — kodni shaxs o'zi so'raydi). */
export async function sendInvite(opts: { email: string; fullName: string; orgName: string; roleLabel: string; hasPassword: boolean }) {
  const url = appUrl();
  const text = opts.hasPassword
    ? `Assalomu alaykum, ${opts.fullName}!\n\nSiz "${opts.orgName}" tashkilotiga ${opts.roleLabel} sifatida qo'shildingiz.\n` +
      `Avvalgi login va parolingiz bilan kiring: ${url}/login\nYuqoridagi tashkilot tanlovidan "${opts.orgName}"ni tanlang.`
    : `Assalomu alaykum, ${opts.fullName}!\n\nSiz "${opts.orgName}" tashkilotiga ${opts.roleLabel} sifatida qo'shildingiz.\n\n` +
      `Kirish uchun:\n1) ${url}/login/code sahifasini oching;\n2) shu e-mail manzilini (${opts.email}) kiriting;\n` +
      `3) pochtangizga kelgan 6 xonali kodni va o'zingiz o'ylagan yangi parolni kiriting.\n\n` +
      `Keyin e-mail (yoki telefon) va shu parol bilan kirasiz. Parolingizni hech kimga aytmang.`;
  const html = opts.hasPassword
    ? mailHtml({
        title: `"${opts.orgName}" tashkilotiga taklif`,
        paragraphs: [
          `Assalomu alaykum, ${opts.fullName}!`,
          `Siz "${opts.orgName}" tashkilotiga ${opts.roleLabel} sifatida qo'shildingiz.`,
          `Avvalgi login va parolingiz bilan kiring, so'ng yuqoridagi tashkilot tanlovidan "${opts.orgName}"ni tanlang.`,
        ],
        link: { href: `${url}/login`, label: "Tizimga kirish" },
      })
    : mailHtml({
        title: `"${opts.orgName}" tashkilotiga taklif`,
        paragraphs: [
          `Assalomu alaykum, ${opts.fullName}!`,
          `Siz "${opts.orgName}" tashkilotiga ${opts.roleLabel} sifatida qo'shildingiz.`,
          `Kirish uchun quyidagi tugmani bosing, shu e-mail manzilini (${opts.email}) kiriting. Pochtangizga 6 xonali kod keladi — uni va o'zingiz o'ylagan yangi parolni kiriting.`,
          `Keyin e-mail (yoki telefon) va shu parol bilan kirasiz. Parolingizni hech kimga aytmang.`,
        ],
        link: { href: `${url}/login/code`, label: "Parol o'rnatish" },
      });
  await sendMail({ to: opts.email, subject: `ReysPro: "${opts.orgName}" tashkilotiga taklif`, text: text + spamTip(), html });
}

function spamTip(): string {
  const from = senderAddress();
  return from ? `\n\n---\nXatlarimiz «Spam»ga tushmasligi uchun ${from} manzilini kontaktlaringizga qo'shing.` : "";
}

export type CodePurpose = "RESET" | "EMAIL";

/** Bir martalik kod yuboradi. Juda tez-tez so'ralsa jim rad etadi (false). */
export async function issueCode(accountId: string, email: string, purpose: CodePurpose, now = new Date()): Promise<boolean> {
  const recent = await db.loginCode.findMany({
    where: { accountId, createdAt: { gt: new Date(now.getTime() - 3_600_000) } },
    select: { createdAt: true },
  });
  if (!canSendCode(recent.map((r) => r.createdAt), now)) return false;
  const code = generateCode();
  // Oldingi kodlar bekor qilinadi: har doim faqat oxirgisi ishlaydi.
  await db.loginCode.updateMany({ where: { accountId, purpose, usedAt: null }, data: { usedAt: now } });
  await db.loginCode.create({
    data: { accountId, purpose, email, codeHash: hashCode(code, codeSecret()), expiresAt: new Date(now.getTime() + CODE_TTL_MINUTES * 60_000) },
  });
  const what = purpose === "RESET" ? "tizimga kirish (parol o'rnatish)" : "yangi e-mail manzilini tasdiqlash";
  const warn = `Kod ${CODE_TTL_MINUTES} daqiqa amal qiladi. Kodni hech kimga aytmang — ReysPro xodimlari, rahbaringiz yoki administrator uni hech qachon so'ramaydi.`;
  const ignore = "Agar siz so'ramagan bo'lsangiz, bu xatni e'tiborsiz qoldiring.";
  await sendMail({
    to: email,
    subject: `ReysPro kodi: ${code}`,
    text: `Sizning ${what} kodingiz: ${code}\n\n${warn}\n\n${ignore}${spamTip()}`,
    html: mailHtml({ title: `Sizning ${what} kodingiz`, paragraphs: [warn, ignore], code }),
  });
  return true;
}

/** Kodni tekshiradi va ishlatilgan deb belgilaydi. Noto'g'ri urinishlar soni cheklangan. */
export async function consumeCode(accountId: string, purpose: CodePurpose, input: string, now = new Date()): Promise<{ email: string } | null> {
  const row = await db.loginCode.findFirst({
    where: { accountId, purpose, usedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
  });
  if (!row || row.attempts >= MAX_CODE_ATTEMPTS) return null;
  if (!codeMatches(input, row.codeHash, codeSecret())) {
    await db.loginCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    return null;
  }
  // Bir vaqtda ikki marta ishlatilmasligi uchun shartli yangilash.
  const done = await db.loginCode.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
  return done.count === 1 ? { email: row.email } : null;
}

export const ROLE_LABEL_UZ: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ACCOUNTANT: "Buxgalter",
  MANAGER: "Menejer",
  DIRECTOR: "Rahbar",
  DEPUTY: "Ishonchli vakil",
  SPECIALIST: "Mutaxassis",
};
