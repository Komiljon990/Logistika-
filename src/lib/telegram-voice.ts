/**
 * Telegram bot: ovozli kiritish (21.11.2026). Sof qismi — voice-core.ts, AI xizmati — ai.ts.
 *
 * - Xodim (to'lov yoki kassa bo'limida kiritish huquqi bo'lsa) botga ovozli xabar yuboradi (2 daqiqagacha).
 * - Bot ovozni matnga o'giradi, AI maydonlarni ajratadi va qoralama kartochkasini ko'rsatadi:
 *   «✅ Tasdiqlash» / «✏️ Tuzatish» / «❌ Bekor». Yetishmagan maydon bo'lsa — variant tugmalari (mijoz, hisob…).
 * - «Tuzatish»dan keyingi ovoz yoki matn tuzatish sifatida olinadi (masalan «summa 4500 dollar»).
 * - Dasturga faqat «Tasdiqlash»da yoziladi; o'sha paytda huquq, tashkilot, hisob va boshqalar qayta tekshiriladi
 *   (saytdagi «+ Kirim» va «Xarajat» bilan bir xil qoidalar). Auditda manba: telegram-voice.
 * "server-only" import qilinmaydi: bot instrumentation.ts dan ishga tushadi.
 */
import type { Prisma } from "@prisma/client";
import { uz } from "@/i18n/uz";
import { db } from "./db";
import { audit } from "./audit";
import { canEdit } from "./access";
import { activeCurrencies } from "./org-currency";
import { cashEnabled, loadAccounts, loadCategories } from "./cash";
import { tashkentToday } from "./docs";
import { recordClientIncome } from "./income";
import { aiConfigured, extractJson, transcribe } from "./ai";
import { apiBase, appLink, botToken, tg } from "./telegram-common";
import { notifyIncome, staffMembers, type StaffMember } from "./telegram-staff";
import {
  EXTRACTION_SCHEMA, applyPick, buildPrompt, draftCard, missingFields, parseLlmJson, resolveDraft,
  type PickField, type VoiceContext, type VoiceDraftData,
} from "./voice-core";

export const MAX_VOICE_SECONDS = 120;
/** Bitta xodimga kuniga (bepul AI limitini tejash uchun). */
export const DAILY_VOICE_LIMIT = 40;
const DRAFT_TTL_MS = 24 * 3_600_000;
const EDIT_TTL_MS = 30 * 60_000;

const today = () => tashkentToday().toISOString().slice(0, 10);

/** Ovozli kiritish shu xodimga ochiqmi (to'lov yoki kassa bo'limida kiritish huquqi). */
export function canVoice(m: StaffMember): boolean {
  return canEdit(m, "settlements") || canEdit(m, "cash");
}

async function send(chatId: number | string, text: string, markup?: unknown): Promise<number | null> {
  const r = await tg<{ message_id?: number }>("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, ...(markup ? { reply_markup: markup } : {}) });
  return r?.message_id ?? null;
}

async function edit(chatId: number | string, messageId: number | null, text: string, markup?: unknown): Promise<number | null> {
  if (messageId) {
    try {
      await tg("editMessageText", { chat_id: chatId, message_id: messageId, text, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: markup ?? { inline_keyboard: [] } });
      return messageId;
    } catch {
      // xabar o'chirilgan yoki eski — yangisini yuboramiz
    }
  }
  return send(chatId, text, markup);
}

/** AI uchun tashkilot ro'yxatlari — faqat xodimga ruxsat etilgan bo'limlardan. */
export async function voiceContext(m: StaffMember): Promise<VoiceContext> {
  const canPay = canEdit(m, "settlements");
  const cashOn = await cashEnabled(m.orgId);
  const [currencies, clients, accounts, tree] = await Promise.all([
    activeCurrencies(m.orgId),
    canPay ? db.client.findMany({ where: { orgId: m.orgId, status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true }, take: 1000 }) : [],
    cashOn ? loadAccounts(m.orgId) : [],
    cashOn && canEdit(m, "cash") ? loadCategories(m.orgId) : [],
  ]);
  const categories = tree.filter((p) => p.active).flatMap((p) => {
    const kids = p.children.filter((c) => c.active);
    return kids.length ? kids.map((c) => ({ id: c.id, label: `${p.name} › ${c.name}` })) : [{ id: p.id, label: p.name }];
  });
  return { today: today(), currencies, clients, accounts: accounts.map((a) => ({ id: a.id, label: a.label, kind: a.kind, currency: a.currency })), categories, cashOn };
}

function keyboard(id: string, d: VoiceDraftData) {
  const rows: { text: string; callback_data: string }[][] = [];
  if (d.pick) d.pick.options.forEach((o, i) => rows.push([{ text: o.label.slice(0, 60), callback_data: `vd:${id}:p${i}` }]));
  const actions: { text: string; callback_data: string }[] = [];
  if (!missingFields(d, today()).length) actions.push({ text: "✅ Tasdiqlash", callback_data: `vd:${id}:ok` });
  if (d.intent !== "unknown") actions.push({ text: "✏️ Tuzatish", callback_data: `vd:${id}:ed` });
  actions.push({ text: "❌ Bekor", callback_data: `vd:${id}:no` });
  rows.push(actions);
  return { inline_keyboard: rows };
}

/** Reys raqami aytilgan bo'lsa — shu tashkilotda qidiriladi. */
async function withTrip(d: VoiceDraftData, orgId: string): Promise<VoiceDraftData> {
  if (d.intent !== "expense" || !d.tripNumber) return { ...d, tripId: null, tripMissing: false };
  const t = await db.trip.findFirst({ where: { orgId, number: d.tripNumber }, select: { id: true } });
  return { ...d, tripId: t?.id ?? null, tripMissing: !t };
}

/** Xodim bir nechta tashkilotda bo'lsa — kiritish huquqi bor birinchisi (kartochkada tashkilot nomi ko'rinadi). */
function pickMember(members: StaffMember[]): StaffMember | null {
  return members.find(canVoice) ?? null;
}

async function editingDraft(chatId: string) {
  return db.voiceDraft.findFirst({
    where: { chatId, status: "EDITING", updatedAt: { gte: new Date(Date.now() - EDIT_TTL_MS) } },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Matn (ovozdan yoki tuzatish) → AI → qoralama → kartochka. `prev` bo'lsa — o'sha qoralama yangilanadi.
 */
async function processText(chatId: string, m: StaffMember, text: string, statusMsg: number | null, prev?: { id: string; transcript: string; data: VoiceDraftData; messageId: number | null }) {
  const ctx = await voiceContext(m);
  const prompt = buildPrompt(ctx, text, prev?.data ?? null);
  const raw = parseLlmJson(await extractJson(prompt.system, prompt.user, EXTRACTION_SCHEMA));
  if (!raw) {
    await edit(chatId, statusMsg, "😕 Xabarni tushuna olmadim. Qaytadan, aniqroq ayting.");
    return;
  }
  const d = await withTrip(resolveDraft(raw, ctx), m.orgId);
  // Huquq: to'lov — settlements, xarajat — cash bo'limida kiritish.
  if ((d.intent === "payment" && !canEdit(m, "settlements")) || (d.intent === "expense" && !canEdit(m, "cash"))) {
    await edit(chatId, statusMsg, d.intent === "payment" ? "⛔ Sizda mijoz to'lovini kiritish huquqi yo'q." : "⛔ Sizda kassa xarajatini kiritish huquqi yo'q.");
    return;
  }
  const transcript = prev ? `${prev.transcript} / ${text}`.slice(-2000) : text.slice(0, 2000);
  const data = d as unknown as Prisma.InputJsonValue;
  let id: string;
  if (prev) {
    await db.voiceDraft.update({ where: { id: prev.id }, data: { transcript, data, status: "PENDING" } });
    id = prev.id;
    // Eski kartochkadagi tugmalar olib tashlanadi — yangisi pastda.
    if (prev.messageId && prev.messageId !== statusMsg) await edit(chatId, prev.messageId, "↩️ Tuzatildi — yangi qoralama pastda.").catch(() => {});
  } else {
    id = (await db.voiceDraft.create({ data: { orgId: m.orgId, userId: m.id, chatId, transcript, data } })).id;
  }
  const orgName = (await staffMembers(chatId)).length > 1 ? m.orgName : null;
  const msg = await edit(chatId, statusMsg, draftCard(d, transcript, today(), orgName), keyboard(id, d));
  await db.voiceDraft.update({ where: { id }, data: { messageId: msg } });
}

async function downloadVoice(fileId: string): Promise<Buffer> {
  const f = await tg<{ file_path?: string }>("getFile", { file_id: fileId });
  if (!f?.file_path) throw new Error("Telegram fayl yo'li qaytarmadi");
  const res = await fetch(`${apiBase()}/file/bot${botToken()}/${f.file_path}`, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Ovoz yuklab olinmadi: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Ovozli xabar (yoki audio fayl) xodimdan. */
export async function staffVoice(chatId: number, voice: { file_id: string; duration?: number }, members: StaffMember[]): Promise<void> {
  const chat = String(chatId);
  const m = pickMember(members);
  if (!m) {
    await send(chatId, "Ovozli kiritish to'lov yoki kassa bo'limida kiritish huquqi bor xodimlar uchun.");
    return;
  }
  if (!aiConfigured()) {
    await send(chatId, "🎙 Ovozli kiritish hali sozlanmagan. Rahbaringiz yoki administratorga ayting.");
    return;
  }
  if ((voice.duration ?? 0) > MAX_VOICE_SECONDS) {
    await send(chatId, `Ovozli xabar ${MAX_VOICE_SECONDS / 60} daqiqadan oshmasin — qisqaroq qilib qaytadan yuboring.`);
    return;
  }
  const since = new Date(`${today()}T00:00:00+05:00`);
  if ((await db.voiceDraft.count({ where: { userId: { in: members.map((x) => x.id) }, createdAt: { gte: since } } })) >= DAILY_VOICE_LIMIT) {
    await send(chatId, `Bugungi ovozli kiritish limiti (${DAILY_VOICE_LIMIT} ta) tugadi. Ertaga yoki saytda kiriting.`);
    return;
  }
  const status = await send(chatId, "🎧 Tinglayapman…");
  try {
    const ctx = await voiceContext(m);
    const hint = ctx.clients.slice(0, 40).map((c) => c.name).join(", ");
    const { text } = await transcribe(await downloadVoice(voice.file_id), hint ? `Mijozlar: ${hint}. So'm, dollar, naqd, bank, karta.` : undefined);
    if (!text) {
      await edit(chat, status, "😕 Ovozdan so'z eshitilmadi. Qaytadan, aniqroq yuboring.");
      return;
    }
    await edit(chat, status, `🎙 <i>«${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}»</i>\n\n⏳ Tushunyapman…`);
    const editing = await editingDraft(chat);
    if (editing && editing.userId === m.id) {
      await processText(chat, m, text, status, { id: editing.id, transcript: editing.transcript, data: editing.data as unknown as VoiceDraftData, messageId: editing.messageId });
    } else {
      await processText(chat, m, text, status);
    }
  } catch (e) {
    console.error("[telegram] ovozli kiritish xatosi:", e instanceof Error ? e.message : e);
    await edit(chat, status, "⚠️ Hozir ovozni qayta ishlab bo'lmadi. Birozdan keyin qaytadan urinib ko'ring yoki saytda kiriting.").catch(() => {});
  }
}

/** «Tuzatish» bosilgandan keyin yozilgan matn. true — tuzatish sifatida qabul qilindi. */
export async function staffVoiceText(chatId: number, text: string, members: StaffMember[]): Promise<boolean> {
  const chat = String(chatId);
  const editing = await editingDraft(chat);
  if (!editing) return false;
  const m = members.find((x) => x.id === editing.userId && x.orgId === editing.orgId);
  if (!m || !canVoice(m)) return false;
  if (!aiConfigured()) return false;
  const status = await send(chatId, "⏳ Tushunyapman…");
  try {
    await processText(chat, m, text.slice(0, 500), status, { id: editing.id, transcript: editing.transcript, data: editing.data as unknown as VoiceDraftData, messageId: editing.messageId });
  } catch (e) {
    console.error("[telegram] ovozli kiritish (tuzatish) xatosi:", e instanceof Error ? e.message : e);
    await edit(chat, status, "⚠️ Hozir tuzatishni qayta ishlab bo'lmadi. Birozdan keyin urinib ko'ring.").catch(() => {});
  }
  return true;
}

type Callback = { id: string; data: string; message: { message_id: number; chat: { id: number } } };

/** Kartochka tugmalari: vd:<id>:ok | ed | no | p<n>. true — bu tugma shu yerniki edi. */
export async function voiceCallback(q: Callback, members: StaffMember[]): Promise<boolean> {
  const mm = /^vd:([a-z0-9]+):(ok|ed|no|p\d)$/.exec(q.data);
  if (!mm) return false;
  const chat = String(q.message.chat.id);
  const answer = (text?: string) => tg("answerCallbackQuery", { callback_query_id: q.id, ...(text ? { text } : {}) }).catch(() => {});
  const draft = await db.voiceDraft.findUnique({ where: { id: mm[1] } });
  if (!draft || draft.chatId !== chat) { await answer("Bu qoralama sizga tegishli emas."); return true; }
  if (draft.status === "SAVED" || draft.status === "CANCELLED") { await answer(draft.status === "SAVED" ? "Allaqachon saqlangan." : "Bekor qilingan."); return true; }
  if (draft.status === "SAVING") { await answer("Saqlanmoqda…"); return true; }
  if (Date.now() - draft.createdAt.getTime() > DRAFT_TTL_MS) {
    await db.voiceDraft.update({ where: { id: draft.id }, data: { status: "CANCELLED" } });
    await answer("Qoralama eskirdi");
    await edit(chat, q.message.message_id, "⌛ Qoralama eskirdi (24 soat). Qaytadan yuboring.");
    return true;
  }
  // Huquq har bosishda qayta tekshiriladi (bloklangan, telefon o'zgargan, tashkilot nofaol bo'lsa — o'tmaydi).
  const m = members.find((x) => x.id === draft.userId && x.orgId === draft.orgId);
  if (!m || !canVoice(m)) { await answer("Sizda bu amal uchun huquq yo'q."); return true; }
  const data = draft.data as unknown as VoiceDraftData;
  const action = mm[2];

  if (action === "no") {
    await db.voiceDraft.update({ where: { id: draft.id }, data: { status: "CANCELLED" } });
    await answer("Bekor qilindi");
    await edit(chat, q.message.message_id, `❌ Bekor qilindi. Dasturga hech narsa yozilmadi.\n\n<i>«${draft.transcript.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}»</i>`);
    return true;
  }
  if (action === "ed") {
    await db.voiceDraft.updateMany({ where: { chatId: chat, status: "EDITING", id: { not: draft.id } }, data: { status: "PENDING" } });
    await db.voiceDraft.update({ where: { id: draft.id }, data: { status: "EDITING" } });
    await answer();
    await send(chat, "✏️ Nimani o'zgartiramiz? Ovozli xabar yoki matn yuboring, masalan: «summa 4500 dollar», «mijoz Alfa Trans», «kecha», «Kapitalbank hisobiga».");
    return true;
  }
  if (action.startsWith("p")) {
    const ctx = await voiceContext(m);
    const next = applyPick(data, ctx, data.pick?.field as PickField, Number(action.slice(1)));
    if (!next) { await answer("Bu variant endi mavjud emas."); return true; }
    await db.voiceDraft.update({ where: { id: draft.id }, data: { data: next as unknown as Prisma.InputJsonValue } });
    await answer("Tanlandi");
    await edit(chat, q.message.message_id, draftCard(next, draft.transcript, today(), members.length > 1 ? m.orgName : null), keyboard(draft.id, next));
    return true;
  }

  // ok — tasdiqlash. Ikki marta bosilsa, faqat birinchisi yozadi.
  if (missingFields(data, today()).length) { await answer("Avval yetishmagan maydonlarni to'ldiring."); return true; }
  const lock = await db.voiceDraft.updateMany({ where: { id: draft.id, status: { in: ["PENDING", "EDITING"] } }, data: { status: "SAVING" } });
  if (lock.count !== 1) { await answer("Allaqachon qayta ishlanmoqda."); return true; }
  try {
    const r = data.intent === "payment" ? await savePayment(m, data, draft.id) : await saveExpense(m, data, draft.id);
    if (!r.ok) {
      await db.voiceDraft.update({ where: { id: draft.id }, data: { status: "PENDING" } });
      await answer("Saqlanmadi");
      await send(chat, `⚠️ Saqlanmadi: ${uz[r.error] ?? r.error}\n«✏️ Tuzatish» bilan to'g'rilang yoki saytda kiriting.`);
      return true;
    }
    await db.voiceDraft.update({ where: { id: draft.id }, data: { status: "SAVED", entity: r.entity, entityId: r.entityId } });
    await answer("Saqlandi ✅");
    const card = draftCard(data, draft.transcript, today(), members.length > 1 ? m.orgName : null).split("\n\n").slice(0, -1).join("\n\n");
    await edit(chat, q.message.message_id, `${card}\n\n✅ <b>Dasturga yozildi.</b> ${appLink(r.href, "Ochish")}`);
  } catch (e) {
    await db.voiceDraft.update({ where: { id: draft.id }, data: { status: "PENDING" } }).catch(() => {});
    console.error("[telegram] ovozli qoralama saqlanmadi:", e instanceof Error ? e.message : e);
    await answer("Xatolik — qaytadan urinib ko'ring");
  }
  return true;
}

type SaveResult = { ok: true; entity: string; entityId: string; href: string } | { ok: false; error: keyof typeof uz };

async function savePayment(m: StaffMember, d: VoiceDraftData, draftId: string): Promise<SaveResult> {
  if (!canEdit(m, "settlements")) return { ok: false, error: "user.error.forbidden" };
  const r = await recordClientIncome({
    orgId: m.orgId, userId: m.id, clientId: d.clientId ?? "", date: d.date ? new Date(`${d.date}T00:00:00Z`) : null, amount: d.amount,
    currency: d.currency ?? "", method: d.method ?? "", accountId: d.accountId, note: d.note,
    auditExtra: { source: "telegram-voice", draftId },
  });
  if (!r.ok) return r;
  void notifyIncome("payment", r.paymentId, m.id);
  return { ok: true, entity: "Payment", entityId: r.paymentId, href: `/clients/${r.clientId}` };
}

/** Xarajat: saytdagi «Kassa → Xarajat» formasi bilan bir xil tekshiruvlar. */
async function saveExpense(m: StaffMember, d: VoiceDraftData, draftId: string): Promise<SaveResult> {
  const orgId = m.orgId;
  if (!canEdit(m, "cash")) return { ok: false, error: "user.error.forbidden" };
  const org = await db.organization.findFirst({ where: { id: orgId, status: "ACTIVE", cashEnabled: true } });
  if (!org) return { ok: false, error: "cash.error.account" };
  if (!d.date || d.date > today()) return { ok: false, error: "pay.error.date" };
  if (d.amount === null || d.amount <= 0 || d.amount > 1e13) return { ok: false, error: "pay.error.amount" };
  const account = await db.cashAccount.findFirst({ where: { id: d.accountId ?? "", orgId, status: "ACTIVE" } });
  if (!account) return { ok: false, error: "cash.error.account" };
  const cat = await db.expenseCategory.findFirst({
    where: { id: d.categoryId ?? "", orgId, status: "ACTIVE" },
    include: { parent: true, _count: { select: { children: { where: { status: "ACTIVE" } } } } },
  });
  if (!cat || (cat.parent && cat.parent.status !== "ACTIVE")) return { ok: false, error: "cash.error.category" };
  if (!cat.parentId && cat._count.children > 0) return { ok: false, error: "cash.error.subcategory" };
  let tripId: string | null = null;
  if (d.tripId) {
    const trip = await db.trip.findFirst({ where: { id: d.tripId, orgId }, select: { id: true } });
    if (!trip) return { ok: false, error: "common.required" };
    tripId = trip.id;
  }
  const e = await db.expense.create({
    data: { orgId, date: new Date(`${d.date}T00:00:00Z`), amount: d.amount, accountId: account.id, categoryId: cat.id, tripId, note: d.note, createdById: m.id },
  });
  await audit({ actorId: m.id, orgId, action: "expense.create", entity: "Expense", entityId: e.id, details: { amount: d.amount, accountId: account.id, categoryId: cat.id, tripId, source: "telegram-voice", draftId } });
  return { ok: true, entity: "Expense", entityId: e.id, href: `/cash/expenses/${e.id}` };
}
