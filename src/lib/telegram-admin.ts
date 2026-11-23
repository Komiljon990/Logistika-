/**
 * Super Admin boti (23.11.2026) — platforma egasi uchun alohida Telegram bot (SUPERADMIN_BOT_TOKEN).
 * "server-only" import qilinmaydi: instrumentation.ts dan ishga tushadi.
 *
 * - Ulanish: /start → «Telefon raqamni yuborish». Raqam faol Super Admin hisobidagi yoki a'zolikdagi raqamga mos
 *   bo'lsagina ulanadi. Ulangan chatlar AppSetting "adminBotChats" da; har so'rovda Super Admin hali faolligi tekshiriladi.
 * - Xabarlar: yangi ariza, kvitansiya yuklandi, tarifni oshirish so'rovi (notifyAdmin orqali).
 * - Tugmalar: Umumiy holat, Arizalar, To'lovlar, Tashkilotlar, Obunasi tugayotganlar — faqat ko'rish.
 *   Tasdiqlash/rad etish saytda qoladi (23.11.2026 qarori). Tashkilotlarning ichki ma'lumotlari (reys, mijoz, pul)
 *   ko'rsatilmaydi — Super Admin ularni ko'rmaydi (TZ §11).
 * - Har kuni 9:00 (Toshkent) — kutayotgan ish bo'lsa, qisqa xulosa.
 */
import { db } from "./db";
import { normalizePhone, formatPhone } from "./phone";
import { adminBotToken, botToken, clip, tgWith } from "./telegram-common";
import { formatDate } from "./dates";
import { daysLeft, tashkentToday } from "./docs";
import { planLabel, som } from "./offer";
import { TRIAL_UNTIL, dmy } from "./billing-core";

type TgChat = { id: number; type?: string };
type AdminUpdate = {
  update_id: number;
  message?: { message_id: number; chat: TgChat; from?: { id: number }; text?: string; contact?: { phone_number: string; user_id?: number } };
};

export const ABTN_SUMMARY = "📊 Umumiy holat";
export const ABTN_APPS = "🆕 Arizalar";
export const ABTN_PAY = "🧾 To'lovlar";
export const ABTN_ORGS = "🏢 Tashkilotlar";
export const ABTN_SUBS = "⏳ Obunasi tugayotganlar";

const KEYBOARD = {
  keyboard: [[{ text: ABTN_SUMMARY }], [{ text: ABTN_APPS }, { text: ABTN_PAY }], [{ text: ABTN_ORGS }, { text: ABTN_SUBS }]],
  resize_keyboard: true,
  is_persistent: true,
};
const CONTACT_KEYBOARD = { keyboard: [[{ text: "📱 Telefon raqamni yuborish", request_contact: true }]], resize_keyboard: true, one_time_keyboard: true };

/** Obunasi shuncha kun ichida tugaydiganlar ko'rsatiladi. */
const SUBS_DAYS = 14;
const DIGEST_HOUR = 9;

type AdminChat = { chatId: string; userId: string; at: string };

function send(chatId: number | string, text: string, markup: unknown = KEYBOARD) {
  const token = adminBotToken();
  if (!token) throw new Error("SUPERADMIN_BOT_TOKEN sozlanmagan");
  return tgWith(token, "sendMessage", { chat_id: chatId, text: clip(text), reply_markup: markup, disable_web_page_preview: true });
}

function link(path: string): string {
  const base = (process.env.APP_URL || process.env.CRM_URL || "").trim().replace(/\/+$/, "");
  return base ? `\n${base}${path}` : "";
}

/** Raqam bo'yicha faol Super Admin a'zoliklari (hisob telefoni yoki a'zolikdagi telefon). */
async function superAdminsByPhone(phone: string) {
  return db.user.findMany({
    where: { role: "SUPER_ADMIN", status: "ACTIVE", isDemo: false, OR: [{ phone }, { account: { phone } }] },
    select: { id: true, fullName: true },
  });
}

async function readChats(): Promise<AdminChat[]> {
  const row = await db.appSetting.findUnique({ where: { key: "adminBotChats" } });
  return Array.isArray(row?.value) ? (row.value as AdminChat[]) : [];
}

async function writeChats(list: AdminChat[]) {
  await db.appSetting.upsert({ where: { key: "adminBotChats" }, create: { key: "adminBotChats", value: list }, update: { value: list } });
}

/** Ulangan va hali faol Super Admin'ga tegishli chatlar. Bloklangan/rolini yo'qotganlar ro'yxatdan chiqariladi. */
export async function adminBotChats(): Promise<string[]> {
  const list = await readChats();
  if (!list.length) return [];
  const ok = new Set((await db.user.findMany({
    where: { id: { in: list.map((c) => c.userId) }, role: "SUPER_ADMIN", status: "ACTIVE" },
    select: { id: true },
  })).map((u) => u.id));
  const keep = list.filter((c) => ok.has(c.userId));
  if (keep.length !== list.length) await writeChats(keep);
  return [...new Set(keep.map((c) => c.chatId))];
}

async function isAdminChat(chatId: string): Promise<boolean> {
  return (await adminBotChats()).includes(chatId);
}

/** notifyAdmin uchun: Super Admin botiga ulangan barcha chatlarga. Bot sozlanmagan yoki chat yo'q bo'lsa — false. */
export async function sendToAdminBot(text: string): Promise<boolean> {
  if (!adminBotToken()) return false;
  const chats = await adminBotChats();
  let ok = false;
  for (const c of chats) {
    try {
      await send(c, text);
      ok = true;
    } catch (e) {
      console.error("[admin-bot] xabar yuborilmadi:", e instanceof Error ? e.message : e);
    }
  }
  return ok;
}

// ---------- Ko'rinishlar (faqat o'qish) ----------

export async function summaryText(now = new Date()): Promise<string> {
  const today = tashkentToday(now);
  const soon = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + SUBS_DAYS));
  const [orgs, blocked, apps, review, unpaid, tractors, ending] = await Promise.all([
    db.organization.count({ where: { isDemo: false, status: "ACTIVE" } }),
    db.organization.count({ where: { isDemo: false, status: { not: "ACTIVE" } } }),
    db.orgApplication.count({ where: { status: "PENDING" } }),
    db.invoice.count({ where: { status: "REVIEW", org: { isDemo: false } } }),
    db.invoice.count({ where: { status: "UNPAID", org: { isDemo: false } } }),
    db.vehicle.count({ where: { type: "TRACTOR", status: "ACTIVE", org: { isDemo: false, status: "ACTIVE" } } }),
    db.organization.count({ where: { isDemo: false, status: "ACTIVE", subEnd: { lte: soon } } }),
  ]);
  const trial = today.toISOString().slice(0, 10) <= TRIAL_UNTIL ? `\n🎁 Bepul davr: ${dmy(TRIAL_UNTIL)} gacha` : "";
  return `📊 ReysPro — umumiy holat\n\n🏢 Faol tashkilotlar: ${orgs}${blocked ? ` (to'xtatilgan: ${blocked})` : ""}\n🚛 Faol tyagachlar: ${tractors}\n` +
    `🆕 Kutayotgan arizalar: ${apps}\n🧾 Tekshiriladigan kvitansiyalar: ${review}\n💤 To'lanmagan hisoblar: ${unpaid}\n` +
    `⏳ Obunasi ${SUBS_DAYS} kunda tugaydiganlar: ${ending}${trial}`;
}

export async function appsText(): Promise<string> {
  const apps = await db.orgApplication.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 10 });
  if (!apps.length) return "🆕 Kutayotgan ariza yo'q.";
  const total = await db.orgApplication.count({ where: { status: "PENDING" } });
  const lines = apps.map((a) =>
    `• ${a.orgName} (STIR ${a.inn})\n  Rahbar: ${a.directorName}, ${formatPhone(a.phone)}\n  Tarif: ${planLabel(a.plan)}, ${a.period === "YEARLY" ? "yillik" : "oylik"} · ${formatDate(a.createdAt)}${link(`/admin/applications/${a.id}`)}`);
  return `🆕 Kutayotgan arizalar: ${total}\n\n${lines.join("\n\n")}${total > apps.length ? `\n\n…va yana ${total - apps.length} ta${link("/admin/applications")}` : ""}\n\nTasdiqlash — saytda.`;
}

export async function paymentsText(): Promise<string> {
  const [review, unpaid] = await Promise.all([
    db.invoice.findMany({
      where: { status: "REVIEW", org: { isDemo: false } }, orderBy: { receiptAt: "asc" }, take: 10,
      select: { number: true, amount: true, receiptAt: true, plan: true, period: true, org: { select: { name: true } } },
    }),
    db.invoice.count({ where: { status: "UNPAID", org: { isDemo: false } } }),
  ]);
  const head = review.length
    ? `🧾 Kvitansiyasi yuklangan, tekshirilishi kerak: ${review.length}\n\n${review.map((i) =>
        `• ${i.org.name} — hisob № ${i.number}: ${som(Number(i.amount))}\n  ${planLabel(i.plan)}, ${i.period === "YEARLY" ? "yillik" : "oylik"}${i.receiptAt ? ` · yuklangan ${formatDate(i.receiptAt)}` : ""}`).join("\n")}`
    : "🧾 Tekshiriladigan kvitansiya yo'q.";
  return `${head}\n\n💤 To'lanmagan hisoblar: ${unpaid}${link("/admin/payments")}`;
}

export async function orgsText(): Promise<string> {
  const orgs = await db.organization.findMany({
    where: { isDemo: false },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    take: 40,
    select: { name: true, status: true, plan: true, subEnd: true, _count: { select: { vehicles: { where: { type: "TRACTOR", status: "ACTIVE" } } } } },
  });
  if (!orgs.length) return "🏢 Hali tashkilot yo'q.";
  const lines = orgs.map((o) =>
    `• ${o.name}${o.status !== "ACTIVE" ? " (to'xtatilgan)" : ""}\n  🚛 ${o._count.vehicles} ta · ${o.plan ? planLabel(o.plan) : "tarifsiz"}${o.subEnd ? ` · obuna ${formatDate(o.subEnd)} gacha` : ""}`);
  return `🏢 Tashkilotlar: ${orgs.length}\n\n${lines.join("\n")}${link("/admin/orgs")}`;
}

export async function subsText(now = new Date()): Promise<string> {
  const today = tashkentToday(now);
  const soon = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + SUBS_DAYS));
  const orgs = await db.organization.findMany({
    where: { isDemo: false, status: "ACTIVE", subEnd: { lte: soon } },
    orderBy: { subEnd: "asc" },
    take: 40,
    select: { name: true, subEnd: true, phone: true },
  });
  if (!orgs.length) return `⏳ ${SUBS_DAYS} kun ichida obunasi tugaydigan tashkilot yo'q.`;
  const lines = orgs.map((o) => {
    const left = daysLeft(o.subEnd, today) ?? 0;
    const when = left < 0 ? `❗ ${-left} kun o'tdi` : left === 0 ? "bugun tugaydi" : `${left} kun qoldi`;
    return `• ${o.name} — ${formatDate(o.subEnd)} (${when})${o.phone ? `\n  📞 ${formatPhone(o.phone)}` : ""}`;
  });
  return `⏳ Obunasi tugayotgan / tugagan: ${orgs.length}\n\n${lines.join("\n")}`;
}

const HELP = `Bu — ReysPro Super Admin boti.\n\n«${ABTN_SUMMARY}» — qisqa xulosa\n«${ABTN_APPS}» — tasdiqlanmagan arizalar\n«${ABTN_PAY}» — kvitansiyalar va to'lanmagan hisoblar\n«${ABTN_ORGS}» — tashkilotlar ro'yxati\n«${ABTN_SUBS}» — obunasi ${SUBS_DAYS} kunda tugaydiganlar\n\nYangi ariza yoki kvitansiya kelsa, shu yerga xabar keladi. Har kuni 9:00 da kutayotgan ishlar bo'lsa — xulosa.`;

/** Super Admin botiga kelgan bitta yangilanish (polling va sinovlar uchun). */
export async function handleAdminUpdate(u: AdminUpdate): Promise<void> {
  const m = u.message;
  if (!m) return;
  // Faqat shaxsiy chat: guruhda platforma ma'lumoti boshqalarga ko'rinib qolardi.
  if (m.chat.type && m.chat.type !== "private") return;
  const chatId = String(m.chat.id);
  if (m.contact) {
    if (!m.from || m.contact.user_id !== m.from.id) {
      await send(m.chat.id, "Iltimos, faqat o'zingizning raqamingizni yuboring — pastdagi tugmani bosing.", CONTACT_KEYBOARD);
      return;
    }
    const phone = normalizePhone(m.contact.phone_number);
    const admins = phone ? await superAdminsByPhone(phone) : [];
    if (!admins.length) {
      await send(m.chat.id, "⛔ Bu bot faqat ReysPro platformasi egasi (Super Admin) uchun.", { remove_keyboard: true });
      return;
    }
    const list = (await readChats()).filter((c) => c.chatId !== chatId);
    for (const a of admins) list.push({ chatId, userId: a.id, at: new Date().toISOString() });
    await writeChats(list);
    await send(m.chat.id, `✅ Siz ulandingiz: ${admins[0].fullName} (Super Admin)\n\n${HELP}`);
    return;
  }
  const text = m.text?.trim();
  if (!text) return;
  const admin = await isAdminChat(chatId);
  if (!admin) {
    await send(m.chat.id, "Assalomu alaykum! Bu — ReysPro Super Admin boti.\nUlanish uchun pastdagi «📱 Telefon raqamni yuborish» tugmasini bosing.", CONTACT_KEYBOARD);
    return;
  }
  if (text === ABTN_SUMMARY || text === "/holat") return void (await send(m.chat.id, await summaryText()));
  if (text === ABTN_APPS || text === "/arizalar") return void (await send(m.chat.id, await appsText()));
  if (text === ABTN_PAY || text === "/tolovlar") return void (await send(m.chat.id, await paymentsText()));
  if (text === ABTN_ORGS || text === "/tashkilotlar") return void (await send(m.chat.id, await orgsText()));
  if (text === ABTN_SUBS || text === "/obuna") return void (await send(m.chat.id, await subsText()));
  await send(m.chat.id, text.startsWith("/start") ? `✅ Siz ulangansiz.\n\n${HELP}` : HELP);
}

/** Kunlik xulosa: kutayotgan ariza, kvitansiya yoki 7 kunda tugaydigan obuna bo'lsa. */
export async function sendAdminDigest(now = new Date()): Promise<boolean> {
  const today = tashkentToday(now);
  const week = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 7));
  const [apps, review, ending] = await Promise.all([
    db.orgApplication.count({ where: { status: "PENDING" } }),
    db.invoice.count({ where: { status: "REVIEW", org: { isDemo: false } } }),
    db.organization.count({ where: { isDemo: false, status: "ACTIVE", subEnd: { lte: week } } }),
  ]);
  if (!apps && !review && !ending) return false;
  return sendToAdminBot(`☀️ Xayrli tong!\n\n${await summaryText(now)}`);
}

const ADMIN_COMMANDS = [
  { command: "holat", description: "Umumiy holat" },
  { command: "arizalar", description: "Kutayotgan arizalar" },
  { command: "tolovlar", description: "Kvitansiyalar va to'lovlar" },
  { command: "tashkilotlar", description: "Tashkilotlar" },
  { command: "obuna", description: "Obunasi tugayotganlar" },
];

const g = globalThis as unknown as { reysproAdminBot?: boolean };

/** Super Admin boti: getUpdates (long polling) va kunlik xulosa. Bitta jarayonda bir marta. */
export function startAdminBot() {
  const token = adminBotToken();
  if (g.reysproAdminBot || !token) return;
  if (token === botToken()) {
    console.error("[admin-bot] SUPERADMIN_BOT_TOKEN asosiy bot tokeni bilan bir xil — alohida bot oching (@BotFather).");
    return;
  }
  g.reysproAdminBot = true;
  void (async () => {
    try {
      const me = await tgWith<{ username: string }>(token, "getMe", {});
      await db.appSetting.upsert({ where: { key: "adminBot" }, create: { key: "adminBot", value: me.username }, update: { value: me.username } });
      await tgWith(token, "deleteWebhook", {});
      await tgWith(token, "setMyCommands", { commands: ADMIN_COMMANDS });
      console.log(`[admin-bot] @${me.username} ishga tushdi (polling)`);
    } catch (e) {
      console.error("[admin-bot] ishga tushmadi:", e instanceof Error ? e.message : e);
    }
    let offset = 0;
    for (;;) {
      try {
        const updates = await tgWith<AdminUpdate[]>(token, "getUpdates", { offset, timeout: 50, allowed_updates: ["message"] }, 65_000);
        for (const u of updates) {
          offset = u.update_id + 1;
          await handleAdminUpdate(u).catch((e) => console.error("[admin-bot] yangilanish xatosi:", e));
        }
      } catch (e) {
        const code = (e as { code?: number }).code;
        console.error("[admin-bot] polling xatosi:", e instanceof Error ? e.message : e);
        await new Promise((r) => setTimeout(r, code === 409 ? 30_000 : 5_000));
      }
    }
  })();
}

/** Har kuni 9:00 (Toshkent) dan keyin bir marta xulosa. */
export function startAdminDigest() {
  if (!adminBotToken()) return;
  const run = async () => {
    const t = tashkentToday();
    if (t.getUTCHours() < DIGEST_HOUR) return;
    const day = t.toISOString().slice(0, 10);
    const row = await db.appSetting.findUnique({ where: { key: "adminDigestDay" } });
    if (row?.value === day) return;
    await db.appSetting.upsert({ where: { key: "adminDigestDay" }, create: { key: "adminDigestDay", value: day }, update: { value: day } });
    await sendAdminDigest();
  };
  const safe = () => run().catch((e) => console.error("[admin-bot] kunlik xulosa xatosi:", e instanceof Error ? e.message : e));
  setTimeout(safe, 90_000);
  setInterval(safe, 600_000);
}
