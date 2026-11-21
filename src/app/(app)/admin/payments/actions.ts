"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { applyPaid } from "@/lib/billing";
import { isPeriod, isPlan } from "@/lib/billing-core";
import { parseDate } from "@/lib/dates";
import { mailHtml, sendMail } from "@/lib/mailer";
import { som } from "@/lib/offer";
import { str } from "@/lib/form";

type State = { error?: string; ok?: boolean };

function refresh(orgId: string) {
  revalidatePath("/admin/payments");
  revalidatePath(`/admin/orgs/${orgId}`);
}

async function mailOrg(orgId: string, subject: string, lines: string[]) {
  const org = await db.organization.findUnique({ where: { id: orgId }, include: { users: { where: { role: "DIRECTOR", status: "ACTIVE" }, include: { account: { select: { email: true } } } } } });
  const to = [...new Set(org?.users.map((u) => u.account.email).filter(Boolean) as string[])];
  for (const email of to) {
    await sendMail({ to: email, subject, text: lines.join("\n"), html: mailHtml({ title: subject.replace(/^ReysPro: /, ""), paragraphs: lines }) }).catch((e) => console.error(e));
  }
}

/** To'lov tasdiqlandi: pul tushgan. Tarif oshirish yoki uzaytirish shu paytda kuchga kiradi. */
export async function confirmInvoice(id: string, _prev: State): Promise<State> {
  const admin = await requirePermission("org.manage");
  const inv = await db.invoice.findUnique({ where: { id } });
  if (!inv || inv.status === "PAID" || inv.status === "CANCELLED") return { error: "app.error.state" };
  const done = await db.invoice.updateMany({ where: { id, status: inv.status }, data: { status: "PAID", reviewedById: admin.id, reviewedAt: new Date(), rejectNote: null } });
  if (done.count !== 1) return { error: "app.error.state" };
  await applyPaid(inv);
  await audit({ actorId: admin.id, orgId: inv.orgId, action: "invoice.paid", entity: "Invoice", entityId: id, details: { number: inv.number } });
  await mailOrg(inv.orgId, "ReysPro: to'lov tasdiqlandi", [`To'lov hisobi № ${inv.number} (${som(Number(inv.amount))}) bo'yicha to'lov qabul qilindi. Rahmat!`]);
  refresh(inv.orgId);
  return { ok: true };
}

/** Kvitansiya noto'g'ri yoki pul tushmagan: hisob yana "to'lanmagan" holatiga qaytadi, rahbarga sabab yuboriladi. */
export async function rejectReceipt(id: string, formData: FormData) {
  const admin = await requirePermission("org.manage");
  const inv = await db.invoice.findUnique({ where: { id } });
  if (!inv || inv.status !== "REVIEW") return;
  const note = str(formData, "note").slice(0, 500) || null;
  await db.invoice.update({ where: { id }, data: { status: "UNPAID", rejectNote: note, reviewedById: admin.id, reviewedAt: new Date() } });
  await audit({ actorId: admin.id, orgId: inv.orgId, action: "invoice.receipt_reject", entity: "Invoice", entityId: id, details: { note } });
  await mailOrg(inv.orgId, "ReysPro: kvitansiya qabul qilinmadi", [
    `To'lov hisobi № ${inv.number} bo'yicha yuklangan kvitansiya qabul qilinmadi.`,
    ...(note ? [`Sabab: ${note}`] : []),
    "Iltimos, Sozlamalar → Obuna bo'limida kvitansiyani qayta yuklang.",
  ]);
  refresh(inv.orgId);
}

export async function cancelInvoice(id: string, _prev: State): Promise<State> {
  const admin = await requirePermission("org.manage");
  const inv = await db.invoice.findUnique({ where: { id } });
  if (!inv || inv.status === "PAID" || inv.status === "CANCELLED") return { error: "app.error.state" };
  await db.invoice.update({ where: { id }, data: { status: "CANCELLED", reviewedById: admin.id, reviewedAt: new Date() } });
  await audit({ actorId: admin.id, orgId: inv.orgId, action: "invoice.cancel", entity: "Invoice", entityId: id, details: { number: inv.number } });
  refresh(inv.orgId);
  return { ok: true };
}

/** Obunani qo'lda o'zgartirish (masalan Super Admin o'zi yaratgan tashkilot yoki kelishuv bo'yicha). */
export async function setSubscription(orgId: string, _prev: State, formData: FormData): Promise<State> {
  const admin = await requirePermission("org.manage");
  const org = await db.organization.findUnique({ where: { id: orgId } });
  if (!org || org.isDemo) return { error: "user.error.org" };
  const plan = str(formData, "plan");
  const period = str(formData, "period");
  const subStart = parseDate(formData.get("subStart"));
  const subEnd = parseDate(formData.get("subEnd"));
  const contractDate = parseDate(formData.get("contractDate"));
  const data = plan === "" ? { plan: null, period: null, subStart: null, subEnd: null } : null;
  if (!data && (!isPlan(plan) || !isPeriod(period) || !subStart || !subEnd || subEnd < subStart)) return { error: "common.required" };
  const update = data ?? { plan, period: period as "MONTHLY" | "YEARLY", subStart, subEnd };
  await db.organization.update({ where: { id: orgId }, data: { ...update, contractDate: contractDate ?? org.contractDate } });
  await audit({ actorId: admin.id, orgId, action: "org.subscription", entity: "Organization", entityId: orgId, details: { plan: plan || null, period: period || null, subStart: subStart?.toISOString() ?? null, subEnd: subEnd?.toISOString() ?? null } });
  refresh(orgId);
  return { ok: true };
}
