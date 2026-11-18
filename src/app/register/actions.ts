"use server";

import { headers } from "next/headers";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { normalizeEmail } from "@/lib/auth-core";
import { normalizePhone, formatPhone } from "@/lib/phone";
import { isPeriod, isPlan, normalizeInn } from "@/lib/billing-core";
import { OFFER_VERSION, planLabel } from "@/lib/offer";
import { getProvider, providerReady } from "@/lib/settings";
import { appUrl, mailHtml, sendMail } from "@/lib/mailer";
import { notifyAdmin } from "@/lib/telegram";
import { str } from "@/lib/form";

export type RegisterState = {
  ok?: boolean;
  error?: "required" | "inn" | "phone" | "email" | "offer" | "plan" | "pending" | "exists" | "limit" | "closed";
  values?: Record<string, string>;
};

async function clientIp(): Promise<string | null> {
  const h = await headers();
  // Cloudflare Tunnel orqali: haqiqiy IP cf-connecting-ip'da (uni mijoz soxtalashtira olmaydi).
  return h.get("cf-connecting-ip")?.trim() || h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

/**
 * Ro'yxatdan o'tish arizasi (oferta qabul qilingach). Super Admin tasdiqlaguncha tashkilot yaratilmaydi.
 * Spamdan himoya: yashirin maydon, bir IP'dan soatiga 3 ta ariza, bir xil e-mail/STIR bilan kutilayotgan ariza bo'lsa — rad.
 */
export async function submitApplication(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const values: Record<string, string> = {};
  for (const k of ["orgName", "inn", "directorName", "phone", "email", "plan", "period"]) values[k] = str(formData, k);
  const bad = (error: RegisterState["error"]): RegisterState => ({ error, values });

  if (!providerReady(await getProvider())) return bad("closed");
  // Robotlar yashirin maydonni to'ldiradi — javob "qabul qilindi", lekin hech narsa saqlanmaydi.
  if (str(formData, "website")) return { ok: true };
  if (formData.get("offer") !== "on" || str(formData, "offerVersion") !== OFFER_VERSION) return bad("offer");
  if (!isPlan(values.plan) || !isPeriod(values.period)) return bad("plan");
  const orgName = values.orgName.slice(0, 200);
  const directorName = values.directorName.slice(0, 200);
  if (!orgName || !directorName) return bad("required");
  const inn = normalizeInn(values.inn);
  if (!inn) return bad("inn");
  const phone = normalizePhone(values.phone);
  if (!phone) return bad("phone");
  const email = normalizeEmail(values.email);
  if (!email) return bad("email");

  const ip = await clientIp();
  const hourAgo = new Date(Date.now() - 3_600_000);
  if (ip && (await db.orgApplication.count({ where: { ip, createdAt: { gt: hourAgo } } })) >= 3) return bad("limit");
  if (await db.orgApplication.findFirst({ where: { status: "PENDING", OR: [{ email }, { inn }] } })) return bad("pending");
  if (await db.organization.findFirst({ where: { inn, isDemo: false } })) return bad("exists");

  const app = await db.orgApplication.create({
    data: { orgName, inn, directorName, phone, email, plan: values.plan, period: values.period, offerVersion: OFFER_VERSION, offerAcceptedAt: new Date(), ip },
  });
  await audit({ actorId: null, action: "application.create", entity: "OrgApplication", entityId: app.id, details: { orgName, inn } });

  const period = values.period === "YEARLY" ? "yillik" : "oylik";
  await notifyAdmin(
    `🆕 Yangi ariza\n${orgName} (STIR ${inn})\nRahbar: ${directorName}\nTel: ${formatPhone(phone)}\nE-mail: ${email}\nTarif: ${planLabel(values.plan)}, ${period}\n\n${appUrl()}/admin/applications/${app.id}`,
  );
  await sendMail({
    to: email,
    subject: "ReysPro: arizangiz qabul qilindi",
    text: `Assalomu alaykum, ${directorName}!\n\n"${orgName}" tashkilotini ro'yxatdan o'tkazish arizangiz qabul qilindi. Ariza tasdiqlangach shu manzilga kirish uchun vaqtinchalik parol yuboriladi.`,
    html: mailHtml({
      title: "Arizangiz qabul qilindi",
      paragraphs: [
        `Assalomu alaykum, ${directorName}!`,
        `"${orgName}" tashkilotini ro'yxatdan o'tkazish arizangiz qabul qilindi.`,
        "Ariza tasdiqlangach shu manzilga kirish uchun vaqtinchalik parol yuboriladi.",
      ],
    }),
  }).catch((e) => console.error("Ariza xati yuborilmadi:", e));
  return { ok: true };
}
