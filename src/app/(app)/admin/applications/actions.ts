"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { linkAccount } from "@/lib/accounts";
import { generateTempPassword } from "@/lib/auth-core";
import { hashPassword } from "@/lib/password";
import { seedOrgCurrencies } from "@/lib/org-currency";
import { dmy, inTrial, isPeriod, isPlan, periodEnd, quote, TRIAL_UNTIL, trialEnd } from "@/lib/billing-core";
import { createInvoice, todayDate } from "@/lib/billing";
import { planLabel, som } from "@/lib/offer";
import { getProvider } from "@/lib/settings";
import { appUrl, mailHtml, senderAddress, sendMail } from "@/lib/mailer";
import { str } from "@/lib/form";

export type ReviewState = { error?: "app.error.state" | "app.error.innTaken" | "user.error.emailDemo" | "user.error.memberExists" };

const TEMP_PASSWORD_DAYS = 7;
const fmtDate = (d: Date) => d.toISOString().slice(0, 10).split("-").reverse().join(".");

/**
 * Arizani tasdiqlash: tashkilot (faol) + rahbar + birinchi obuna va to'lov hisobi. Bepul sinov davrida
 * (31.12.2026 gacha) hisob chiqmaydi: obuna sinov oxirigacha, keyingi davr — "Sozlamalar → Obuna"dan uzaytirish. Rahbarga e-mail:
 * vaqtincha parol (7 kun; birinchi kirishda o'z parolini o'rnatadi). Super Admin parolni ko'rmaydi.
 * Shaxsning ReysPro'da paroli allaqachon bo'lsa — parol yuborilmaydi, avvalgi login bilan kiradi.
 */
export async function approveApplication(id: string, _prev: ReviewState): Promise<ReviewState> {
  const admin = await requirePermission("org.manage");
  const app = await db.orgApplication.findUnique({ where: { id } });
  if (!app || app.status !== "PENDING" || !isPlan(app.plan) || !isPeriod(app.period)) return { error: "app.error.state" };
  if (await db.organization.findFirst({ where: { inn: app.inn, isDemo: false } })) return { error: "app.error.innTaken" };
  const link = await linkAccount(app.email, app.phone);
  if ("error" in link) return { error: link.error };

  const today = todayDate();
  const trial = inTrial(today);
  const end = trial ? trialEnd() : periodEnd(today, app.period);
  const org = await db.organization.create({
    data: {
      name: app.orgName, inn: app.inn, phone: app.phone, email: app.email,
      plan: app.plan, period: app.period, contractDate: today, subStart: today, subEnd: end,
    },
  });
  await seedOrgCurrencies(org.id);
  const member = await db.user.create({
    data: { accountId: link.accountId, orgId: org.id, role: "DIRECTOR", fullName: app.directorName, phone: app.phone, email: app.email },
  });

  let tempPassword: string | null = null;
  if (!link.hasPassword) {
    tempPassword = generateTempPassword();
    await db.account.update({
      where: { id: link.accountId },
      data: {
        passwordHash: await hashPassword(tempPassword), mustChangePassword: true,
        tempPasswordUntil: new Date(Date.now() + TEMP_PASSWORD_DAYS * 86_400_000), failedLogins: 0, lockedUntil: null,
      },
    });
  }
  const q = quote(app.plan, app.period, today);
  const invoice = trial ? null : await createInvoice({ orgId: org.id, kind: "NEW", plan: app.plan, period: app.period, start: today, end, q, actorId: admin.id });
  await db.orgApplication.update({ where: { id }, data: { status: "APPROVED", orgId: org.id, reviewedById: admin.id, reviewedAt: new Date() } });
  await audit({ actorId: admin.id, orgId: org.id, action: "application.approve", entity: "OrgApplication", entityId: id, details: { orgId: org.id, directorId: member.id, invoice: invoice?.number ?? null, trial } });

  await sendApprovalMail({
    email: app.email, name: app.directorName, orgName: app.orgName, tempPassword, contractDate: today,
    plan: app.plan, period: app.period, end, invoice: invoice ? { number: invoice.number, amount: q.amount } : null,
  }).catch((e) => console.error("Tasdiq xati yuborilmadi:", e));
  redirect(`/admin/orgs/${org.id}?created=1`);
}

async function sendApprovalMail(o: {
  email: string; name: string; orgName: string; tempPassword: string | null; contractDate: Date;
  plan: string; period: "MONTHLY" | "YEARLY"; end: Date; invoice: { number: number; amount: number } | null;
}) {
  const p = await getProvider();
  const url = appUrl();
  const login = o.tempPassword
    ? [
        `Kirish manzili: ${url}/login`,
        `Login: ${o.email}`,
        `Vaqtincha parol ${TEMP_PASSWORD_DAYS} kun amal qiladi. Birinchi kirishda o'zingiz o'ylagan yangi parolni o'rnatasiz. Parolni hech kimga aytmang.`,
      ]
    : [`Kirish manzili: ${url}/login — ReysPro'dagi avvalgi login va parolingiz bilan kiring, so'ng "${o.orgName}" tashkilotini tanlang.`];
  const pay = o.invoice
    ? [
        `Shartnoma (ommaviy oferta) sanasi: ${fmtDate(o.contractDate)}. Tarif: ${planLabel(o.plan)}, ${o.period === "YEARLY" ? "yillik" : "oylik"}; obuna ${fmtDate(o.end)} gacha.`,
        `To'lov hisobi № ${o.invoice.number}: ${som(o.invoice.amount)}. To'lov maqsadida "ReysPro, hisob № ${o.invoice.number}" deb yozing.`,
        `Rekvizitlar: ${[p.name, p.inn && `STIR ${p.inn}`, p.bank, p.mfo && `MFO ${p.mfo}`, p.account && `h/r ${p.account}`].filter(Boolean).join(", ")}.`,
        "To'lovdan keyin kvitansiyani tizimdagi Sozlamalar → Obuna bo'limiga yuklang.",
      ]
    : [
        `Shartnoma (ommaviy oferta) sanasi: ${fmtDate(o.contractDate)}. Tanlangan tarif: ${planLabel(o.plan)}, ${o.period === "YEARLY" ? "yillik" : "oylik"}.`,
        `${dmy(TRIAL_UNTIL)} gacha ReysPro bepul: transportlar soni cheklanmaydi, to'lov talab qilinmaydi.`,
        "Pullik obuna 2027 yil 1 yanvardan boshlanadi. Dekabr oyida Sozlamalar → Obuna bo'limida tarifni tanlab, to'lov hisobini olasiz.",
      ];
  const head = [`Assalomu alaykum, ${o.name}!`, `"${o.orgName}" tashkilotini ro'yxatdan o'tkazish arizangiz tasdiqlandi.`];
  const from = senderAddress();
  await sendMail({
    to: o.email,
    subject: "ReysPro: arizangiz tasdiqlandi",
    text: [...head, "", ...(o.tempPassword ? [`Vaqtincha parol: ${o.tempPassword}`] : []), ...login, "", ...pay, ...(from ? ["", `Xatlarimiz «Spam»ga tushmasligi uchun ${from} manzilini kontaktlarga qo'shing.`] : [])].join("\n"),
    html: mailHtml({
      title: "Arizangiz tasdiqlandi",
      paragraphs: [...head, ...(o.tempPassword ? ["Yuqoridagi — vaqtincha parolingiz."] : []), ...login, ...pay],
      code: o.tempPassword ?? undefined,
      link: { href: `${url}/login`, label: "Tizimga kirish" },
    }),
  });
}

export async function rejectApplication(id: string, formData: FormData) {
  const admin = await requirePermission("org.manage");
  const app = await db.orgApplication.findUnique({ where: { id } });
  if (!app || app.status !== "PENDING") return;
  const reason = str(formData, "reason").slice(0, 500) || null;
  await db.orgApplication.update({ where: { id }, data: { status: "REJECTED", rejectReason: reason, reviewedById: admin.id, reviewedAt: new Date() } });
  await audit({ actorId: admin.id, action: "application.reject", entity: "OrgApplication", entityId: id, details: { reason } });
  if (formData.get("notify") === "on") {
    const lines = [`Assalomu alaykum, ${app.directorName}!`, `Afsuski, "${app.orgName}" tashkilotini ro'yxatdan o'tkazish arizangiz rad etildi.`, ...(reason ? [`Sabab: ${reason}`] : [])];
    await sendMail({ to: app.email, subject: "ReysPro: ariza bo'yicha javob", text: lines.join("\n"), html: mailHtml({ title: "Ariza bo'yicha javob", paragraphs: lines }) })
      .catch((e) => console.error("Rad xati yuborilmadi:", e));
  }
  revalidatePath("/admin/applications");
  redirect("/admin/applications");
}
