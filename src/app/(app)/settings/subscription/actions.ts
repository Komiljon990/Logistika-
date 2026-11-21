"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { orgForWrite } from "@/lib/scope";
import { checkFile, MAX_FILE_BYTES } from "@/lib/files";
import { canRenew, fitsPlan, inTrial, isPeriod, isPlan, periodEnd, quote, renewalStart, upgradeQuote } from "@/lib/billing-core";
import { activeTractors, createInvoice, todayDate } from "@/lib/billing";
import { planLabel, som } from "@/lib/offer";
import { appUrl } from "@/lib/mailer";
import { notifyAdmin } from "@/lib/telegram";
import { str } from "@/lib/form";
import type { Dict } from "@/i18n";

type State = { error?: keyof Dict; ok?: boolean };

async function billing() {
  const user = await requirePermission("billing.manage");
  const orgId = orgForWrite(user);
  const org = await db.organization.findUniqueOrThrow({ where: { id: orgId } });
  return { user, org };
}

/** Kvitansiya (to'lov topshiriqnomasi) yuklash: hisob "tekshiruvda" bo'ladi, Super Admin botiga xabar boradi. */
export async function uploadReceipt(invoiceId: string, _prev: State, formData: FormData): Promise<State> {
  const { user, org } = await billing();
  const inv = await db.invoice.findFirst({ where: { id: invoiceId, orgId: org.id } });
  if (!inv || (inv.status !== "UNPAID" && inv.status !== "REVIEW")) return { error: "app.error.state" };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "sub.error.file" };
  if (file.size > MAX_FILE_BYTES) return { error: "doc.error.size" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkFile(bytes, file.name);
  if (!check.ok) return { error: check.error === "type" ? "doc.error.type" : "doc.error.size" };
  await db.$transaction(async (tx) => {
    const stored = await tx.storedFile.create({
      data: { orgId: org.id, name: file.name.slice(0, 200) || "kvitansiya", mime: check.mime, size: bytes.byteLength, data: Buffer.from(bytes), uploadedById: user.id },
    });
    const old = inv.receiptFileId;
    await tx.invoice.update({ where: { id: inv.id }, data: { receiptFileId: stored.id, receiptAt: new Date(), status: "REVIEW", rejectNote: null } });
    if (old) await tx.storedFile.delete({ where: { id: old } });
  });
  await audit({ actorId: user.id, orgId: org.id, action: "invoice.receipt", entity: "Invoice", entityId: inv.id, details: { number: inv.number } });
  await notifyAdmin(`🧾 Kvitansiya yuklandi\n${org.name}${org.inn ? ` (STIR ${org.inn})` : ""}\nHisob № ${inv.number}: ${som(Number(inv.amount))}\nYukladi: ${user.fullName}\n\n${appUrl()}/admin/payments`);
  revalidatePath("/settings/subscription");
  return { ok: true };
}

/** Obuna orasida tarifni oshirish: qolgan davr uchun farq bo'yicha hisob. Yangi tarif to'lov tasdiqlangach kuchga kiradi. */
export async function requestUpgrade(_prev: State, formData: FormData): Promise<State> {
  const { user, org } = await billing();
  const to = str(formData, "plan");
  if (!isPlan(to) || !isPlan(org.plan) || !org.period || !org.subStart || !org.subEnd) return { error: "sub.error.noSub" };
  const today = todayDate();
  if (inTrial(today)) return { error: "sub.error.trial" };
  const q = upgradeQuote({ plan: org.plan, period: org.period, start: org.subStart, end: org.subEnd }, to, today);
  if (!q.ok) return { error: q.error === "expired" ? "sub.error.expired" : "sub.error.notHigher" };
  // Avvalgi to'lanmagan "oshirish" hisoblari bekor qilinadi — har doim bittasi.
  await db.invoice.updateMany({ where: { orgId: org.id, kind: "UPGRADE", status: "UNPAID" }, data: { status: "CANCELLED" } });
  const inv = await createInvoice({ orgId: org.id, kind: "UPGRADE", plan: to, period: org.period, start: today, end: org.subEnd, q, actorId: user.id });
  await audit({ actorId: user.id, orgId: org.id, action: "invoice.create", entity: "Invoice", entityId: inv.id, details: { kind: "UPGRADE", plan: to, amount: q.amount } });
  await notifyAdmin(`⬆️ Tarifni oshirish so'rovi\n${org.name}: ${planLabel(org.plan)} → ${planLabel(to)}\nHisob № ${inv.number}: ${som(q.amount)}`);
  revalidatePath("/settings/subscription");
  return { ok: true };
}

/** Keyingi davrga uzaytirish (tugashiga 30 kun qolganda yoki tugagach). Tarif faol tyagachlar soniga sig'ishi kerak. */
export async function requestRenewal(_prev: State, formData: FormData): Promise<State> {
  const { user, org } = await billing();
  const plan = str(formData, "plan");
  const period = str(formData, "period");
  if (!isPlan(plan) || !isPeriod(period)) return { error: "reg.error.plan" };
  const today = todayDate();
  if (!canRenew(org.subEnd, today)) return { error: "sub.error.early" };
  if (!fitsPlan(plan, await activeTractors(org.id))) return { error: "sub.error.tooSmall" };
  await db.invoice.updateMany({ where: { orgId: org.id, kind: "RENEWAL", status: "UNPAID" }, data: { status: "CANCELLED" } });
  const start = renewalStart(org.subEnd, today);
  const q = quote(plan, period, today);
  const inv = await createInvoice({ orgId: org.id, kind: "RENEWAL", plan, period, start, end: periodEnd(start, period), q, actorId: user.id });
  await audit({ actorId: user.id, orgId: org.id, action: "invoice.create", entity: "Invoice", entityId: inv.id, details: { kind: "RENEWAL", plan, period, amount: q.amount } });
  revalidatePath("/settings/subscription");
  return { ok: true };
}
