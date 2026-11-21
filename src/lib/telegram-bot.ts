/**
 * ReysPro Telegram boti (17.11.2026). "server-only" import qilinmaydi: instrumentation.ts dan ham ishga tushadi.
 *
 * - Haydovchi botga /start yozadi va "Telefon raqamni yuborish" tugmasini bosadi. Telegram o'zining raqamini
 *   yuborgan bo'lsa (contact.user_id === from.id), shu raqamli faol haydovchilarga chat bog'lanadi.
 * - TIR/dazvol haydovchiga berilganda yoki u qaytarganda xabar boradi: "Tasdiqlash" / "Rad etish" tugmalari.
 *   Javob faqat xabar yuborilgan chatdan qabul qilinadi.
 * - Server lokal tarmoqda (ochiq HTTPS manzil yo'q), shuning uchun webhook emas — getUpdates (long polling).
 * - 19.11.2026: tashkilot xodimlari ham shu tugma bilan ulanadi — ularning qismi telegram-staff.ts da (faqat ko'rish).
 */
import { db } from "./db";
import { normalizePhone } from "./phone";
import { formatDate } from "./dates";
import type { TripEventType } from "@prisma/client";
import { EVENT_ORDER, checkEvent, completesTrip, nextEvents } from "./trips-core";
import { EV_DONE_UZ, EV_UZ, apiBase, botToken, fmtTime, tg } from "./telegram-common";
import { STAFF_ROWS, linkStaff, staffMembers, staffText, type StaffMember } from "./telegram-staff";
import { syncBotProfile } from "./telegram-profile";
import { staffVoice, staffVoiceText, voiceCallback } from "./telegram-voice";

type TgChat = { id: number; type?: string; first_name?: string; last_name?: string; username?: string; title?: string };
type TgUpdate = {
  update_id: number;
  message?: {
    message_id: number; chat: TgChat; from?: { id: number }; text?: string; contact?: { phone_number: string; user_id?: number };
    voice?: { file_id: string; duration?: number }; audio?: { file_id: string; duration?: number };
  };
  callback_query?: { id: string; from: { id: number }; data?: string; message?: { message_id: number; chat: TgChat; text?: string } };
};

export { apiBase, botToken, tg };

const TYPE_UZ = { TIR: "TIR karnet", DAZVOL: "Dazvol" } as const;

async function rememberChat(chat: TgChat) {
  const name = [chat.title, chat.first_name, chat.last_name, chat.username ? `@${chat.username}` : ""].filter(Boolean).join(" ");
  const row = await db.appSetting.findUnique({ where: { key: "telegramChats" } });
  const list = ((row?.value as { id: string; name: string; at: string }[] | null) ?? []).filter((c) => c.id !== String(chat.id));
  list.unshift({ id: String(chat.id), name, at: new Date().toISOString() });
  const value = list.slice(0, 20);
  await db.appSetting.upsert({ where: { key: "telegramChats" }, create: { key: "telegramChats", value }, update: { value } });
}

const CONTACT_KEYBOARD = {
  keyboard: [[{ text: "📱 Telefon raqamni yuborish", request_contact: true }]],
  resize_keyboard: true,
  one_time_keyboard: true,
};

// ---------- Reys bosqichlari va hisob (18.11.2026) ----------

const BTN_TRIP = "🚚 Reysim";
const BTN_BALANCE = "💰 Hisobim";
// 19.11.2026: qo'limdagi TIR/dazvol, menejer telefoni, yordam.
const BTN_DOCS = "📄 Hujjatlarim";
const BTN_MANAGER = "☎️ Menejer";
const BTN_HELP = "❓ Yordam";

const DRIVER_HELP = `«${BTN_TRIP}» — reys bosqichlarini belgilash\n«${BTN_BALANCE}» — hisob-kitob\n«${BTN_DOCS}» — qo'lingizdagi TIR/dazvol\n«${BTN_MANAGER}» — menejer telefoni`;
const STAFF_HELP = "«📊 Bugun» — qisqa holat\n«🚚 Faol reyslar» — yo'ldagi reyslar\n«⚠️ Ogohlantirishlar» — muddati tugayotgan hujjatlar\n«🔎 Qidiruv» — yoki shunchaki davlat raqami, reys raqami yoki mijoz nomini yozing\n\n🎙 Ovozli kiritish: mijoz to'lovi yoki xarajatni ovoz bilan ayting (masalan «Alfa Trans 5000 dollar to'ladi, bankka» yoki «42-reysga 300 dollar yoqilg'i, kassadan»). Bot qoralamani ko'rsatadi — tasdiqlasangizgina dasturga yoziladi.";
const WELCOME = "Assalomu alaykum! 👋\nBu — ReysPro boti.\n\nHaydovchi yoki tashkilot xodimi bo'lsangiz, pastdagi «📱 Telefon raqamni yuborish» tugmasini bosing. Bot sizni tashkilotingizga o'zi ulaydi.";

/**
 * Pastki tugmalar (19.11.2026): haydovchiga «Reysim» / «Hisobim», xodimga «Bugun», «Faol reyslar», «Ogohlantirishlar»,
 * «Qidiruv». Bir kishi ham haydovchi, ham xodim bo'lsa — ikkalasi.
 */
function keyboardFor(isDriver: boolean, isStaff: boolean) {
  const rows: { text: string }[][] = [];
  if (isDriver) rows.push([{ text: BTN_TRIP }, { text: BTN_BALANCE }], [{ text: BTN_DOCS }, { text: BTN_MANAGER }]);
  if (isStaff) for (const r of STAFF_ROWS) rows.push(r.map((text) => ({ text })));
  if (rows.length) rows.push([{ text: BTN_HELP }]);
  return rows.length ? { keyboard: rows, resize_keyboard: true, is_persistent: true } : { remove_keyboard: true };
}

async function isDriverChat(chatId: string): Promise<boolean> {
  return (await db.driver.count({ where: { telegramChatId: chatId, status: "ACTIVE" } })) > 0;
}

/** Shu chat uchun to'g'ri tugmalar (haydovchi va/yoki xodim). */
async function chatKeyboard(chatId: string, staff?: StaffMember[]) {
  return keyboardFor(await isDriverChat(chatId), (staff ?? (await staffMembers(chatId))).length > 0);
}

const tripNo = (n: number) => `TSH-${String(n).padStart(4, "0")}`;

/** Reys haqida matn va keyingi bosqich tugmasi. */
async function tripCard(tripId: string): Promise<{ text: string; markup?: unknown } | null> {
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    include: { tractor: { select: { plate: true } }, trailer: { select: { plate: true } }, events: { orderBy: { at: "asc" } }, org: { select: { name: true } } },
  });
  if (!trip) return null;
  const done = Object.fromEntries(trip.events.map((e) => [e.type, e.at]));
  const steps = EVENT_ORDER.map((s) => (done[s] ? `✅ ${EV_DONE_UZ[s]} — ${fmtTime(done[s] as Date)}` : `▫️ ${EV_DONE_UZ[s]}`));
  const head = `🚚 ${tripNo(trip.number)}: ${trip.routeFrom} → ${trip.routeTo}\n📅 Yuklash: ${formatDate(trip.loadDate)}\n🚛 Tyagach: ${trip.tractor.plate}${trip.trailer ? `, prisep: ${trip.trailer.plate}` : ""}${trip.cargo ? `\n📦 Yuk: ${trip.cargo}` : ""}\n🏢 ${trip.org.name}`;
  if (trip.status !== "ACTIVE") return { text: `${head}\n\n${steps.join("\n")}\n\n${trip.status === "COMPLETED" ? "🏁 Reys yakunlandi. Rahmat, yo'lingiz bexatar bo'lsin!" : "❌ Reys bekor qilingan."}` };
  const next = nextEvents(done)[0];
  return {
    text: `${head}\n\n${steps.join("\n")}${next ? "\n\nBosqich bajarilganda pastdagi tugmani bosing:" : ""}`,
    markup: next ? { inline_keyboard: [[{ text: `✅ ${EV_UZ[next]}`, callback_data: `ev:${trip.id}:${next}` }]] } : undefined,
  };
}

/** Haydovchining (shu chatga ulangan) faol reyslari. */
async function chatTrips(chatId: string) {
  return db.trip.findMany({
    where: { status: "ACTIVE", driver: { telegramChatId: chatId, status: "ACTIVE" } },
    orderBy: { loadDate: "asc" },
    select: { id: true },
    take: 5,
  });
}

/** Yangi reys tayinlanganda haydovchiga xabar (bot va chat ulangan bo'lsa). Xato asosiy amalni to'xtatmaydi. */
export async function notifyNewTrip(tripId: string): Promise<void> {
  try {
    if (!botToken()) return;
    const trip = await db.trip.findUnique({ where: { id: tripId }, select: { driver: { select: { telegramChatId: true } } } });
    const chat = trip?.driver.telegramChatId;
    if (!chat) return;
    const card = await tripCard(tripId);
    if (!card) return;
    await tg("sendMessage", { chat_id: chat, text: `🆕 Sizga yangi reys tayinlandi!\n\n${card.text}`, reply_markup: card.markup ?? (await chatKeyboard(chat)) });
  } catch (e) {
    console.error("Yangi reys xabari yuborilmadi:", e instanceof Error ? e.message : e);
  }
}

/** Haydovchi botda bosqichni belgiladi: tekshiruv menejer formasidagi bilan bir xil (tartib, vaqt). */
async function driverEvent(chatId: string, tripId: string, type: string): Promise<{ ok: true } | { ok: false; text: string }> {
  const { autoTripCharge } = await import("./driver-ledger");
  if (!(EVENT_ORDER as readonly string[]).includes(type)) return { ok: false, text: "Noma'lum bosqich." };
  const at = new Date();
  let completed = false;
  let createdBy = "system";
  const res = await db.$transaction(async (tx) => {
    const trip = await tx.trip.findUnique({ where: { id: tripId }, include: { driver: { select: { telegramChatId: true } } } });
    if (!trip || trip.driver.telegramChatId !== chatId) return { ok: false as const, text: "Bu reys sizga tegishli emas." };
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${trip.orgId}))::text`;
    if (trip.status !== "ACTIVE") return { ok: false as const, text: "Reys yopilgan." };
    const events = await tx.tripEvent.findMany({ where: { tripId }, select: { type: true, at: true } });
    const done = Object.fromEntries(events.map((e) => [e.type, e.at]));
    const check = checkEvent(type as TripEventType, at, done);
    if (!check.ok) return { ok: false as const, text: check.error === "trip.error.order" ? "Bu bosqich allaqachon belgilangan yoki navbati emas." : "Vaqt noto'g'ri." };
    await tx.tripEvent.create({ data: { tripId, type: type as TripEventType, at, source: "DRIVER" } });
    if (completesTrip({ ...done, [type]: at })) {
      await tx.trip.update({ where: { id: tripId }, data: { status: "COMPLETED" } });
      completed = true;
    }
    createdBy = trip.createdById;
    await tx.auditLog.create({ data: { actorId: null, orgId: trip.orgId, action: "trip.event", entity: "Trip", entityId: tripId, details: { type, at: at.toISOString(), source: "DRIVER" } } });
    return { ok: true as const };
  });
  if (res.ok && completed) await autoTripCharge(tripId, createdBy);
  return res;
}

async function sendTrips(chatId: number) {
  const trips = await chatTrips(String(chatId));
  if (!trips.length) {
    await tg("sendMessage", { chat_id: chatId, text: "Hozircha sizda faol reys yo'q. Yangi reys tayinlansa, darhol xabar beraman. 🙂", reply_markup: await chatKeyboard(String(chatId)) });
    return;
  }
  for (const t of trips) {
    const card = await tripCard(t.id);
    if (card) await tg("sendMessage", { chat_id: chatId, text: card.text, reply_markup: card.markup ?? (await chatKeyboard(String(chatId))) });
  }
}

async function sendBalance(chatId: number) {
  const { balanceLines } = await import("./driver-ledger");
  const drivers = await db.driver.findMany({ where: { telegramChatId: String(chatId), status: "ACTIVE" }, select: { id: true, category: true, org: { select: { name: true } } } });
  if (!drivers.length) {
    await tg("sendMessage", { chat_id: chatId, text: "Siz hali ulanmagansiz. /start bosing.", reply_markup: CONTACT_KEYBOARD });
    return;
  }
  const parts: string[] = [];
  for (const d of drivers) {
    const lessor = d.category === "OWNER_OPERATOR";
    const lines = await balanceLines(d.id, lessor ? "LESSOR" : "STAFF");
    parts.push(lessor
      ? `${d.org.name}: ${lines.length ? `qarzingiz ${lines.join(", ")}` : "qarzingiz yo'q"}`
      : `${d.org.name}: ${lines.length ? `tashkilotning sizdan qarzi ${lines.join(", ")}` : "hisob-kitob yopilgan"}`);
  }
  await tg("sendMessage", { chat_id: chatId, text: `💰 Hisobingiz\n${parts.join("\n")}`, reply_markup: await chatKeyboard(String(chatId)) });
}

const PERMIT_FORMAT_UZ = { ELECTRONIC: " (elektron)", PAPER: " (qog'oz)" } as const;

/** Haydovchi qo'lidagi (berilgan, hali qaytarilmagan) TIR/dazvollar. */
async function sendDocs(chatId: number) {
  const permits = await db.permit.findMany({
    where: { status: "ISSUED", driver: { telegramChatId: String(chatId), status: "ACTIVE" } },
    orderBy: [{ validUntil: "asc" }, { number: "asc" }],
    select: { type: true, number: true, country: true, format: true, validUntil: true, issuedAt: true, vehicle: { select: { plate: true } }, driver: { select: { org: { select: { name: true } } } } },
    take: 30,
  });
  const lines = permits.map((p) =>
    `• ${TYPE_UZ[p.type]}${p.format ? PERMIT_FORMAT_UZ[p.format] : ""} № ${p.number}${p.country ? `, ${p.country}` : ""}` +
    `${p.validUntil ? ` — ${formatDate(p.validUntil)} gacha` : ""}${p.vehicle ? `\n   🚛 ${p.vehicle.plate}` : ""}${p.issuedAt ? `, berilgan: ${formatDate(p.issuedAt)}` : ""} · ${p.driver?.org.name ?? ""}`);
  await tg("sendMessage", {
    chat_id: chatId,
    text: lines.length ? `📄 Qo'lingizdagi hujjatlar:\n${lines.join("\n")}` : "📄 Hozir qo'lingizda TIR yoki dazvol yo'q.",
    reply_markup: await chatKeyboard(String(chatId)),
  });
}

/** Faol reysni ochgan menejer(lar) telefoni; reys bo'lmasa — tashkilot telefoni. */
async function sendManager(chatId: number) {
  const drivers = await db.driver.findMany({
    where: { telegramChatId: String(chatId), status: "ACTIVE" },
    select: { org: { select: { name: true, phone: true } }, trips: { where: { status: "ACTIVE" }, orderBy: { loadDate: "asc" }, take: 5, select: { number: true, createdById: true } } },
  });
  const userIds = [...new Set(drivers.flatMap((d) => d.trips.map((t) => t.createdById)))];
  const users = new Map((await db.user.findMany({ where: { id: { in: userIds }, status: "ACTIVE" }, select: { id: true, fullName: true, phone: true } })).map((u) => [u.id, u]));
  const parts: string[] = [];
  for (const d of drivers) {
    const lines: string[] = [];
    for (const t of d.trips) {
      const u = users.get(t.createdById);
      if (u) lines.push(`🚚 ${tripNo(t.number)}: ${u.fullName}${u.phone ? ` — ${u.phone}` : ""}`);
    }
    if (!lines.length) lines.push(d.org.phone ? `📞 Tashkilot telefoni: ${d.org.phone}` : "Telefon kiritilmagan — rahbaringizga murojaat qiling.");
    parts.push(`🏢 ${d.org.name}\n${[...new Set(lines)].join("\n")}`);
  }
  await tg("sendMessage", { chat_id: chatId, text: `☎️ Menejer bilan bog'lanish\n\n${parts.join("\n\n")}`, reply_markup: await chatKeyboard(String(chatId)) });
}

async function sendHelp(chatId: number, isDriver: boolean, isStaff: boolean) {
  const parts = [
    ...(isDriver ? [`🚚 Haydovchi uchun:\n${DRIVER_HELP}`] : []),
    ...(isStaff ? [`👤 Xodim uchun:\n${STAFF_HELP}`] : []),
  ];
  await tg("sendMessage", {
    chat_id: chatId,
    text: `ℹ️ ReysPro boti\n\n${parts.join("\n\n")}\n\nMuammo bo'lsa, menejeringizga yoki rahbaringizga murojaat qiling.\nSayt: reyspro.uz`,
    reply_markup: keyboardFor(isDriver, isStaff),
  });
}

/**
 * Ulanmagan foydalanuvchiga /start javobi: rasm (sayt manzili bo'lsa, Telegram uni o'zi yuklab oladi) va tugma.
 * Rasm yuborilmasa — oddiy matn. Birinchi yuborishdan keyin Telegram file_id saqlanadi.
 */
async function sendWelcome(chatId: number) {
  const base = (process.env.APP_URL || process.env.CRM_URL || "").trim().replace(/\/+$/, "");
  if (base) {
    const url = `${base}/bot/xush-kelibsiz.jpg`;
    try {
      const row = await db.appSetting.findUnique({ where: { key: "telegramWelcomePhoto" } });
      const cached = row?.value as { url: string; fileId: string } | null;
      const sent = await tg<{ photo?: { file_id: string }[] }>("sendPhoto", {
        chat_id: chatId, photo: cached?.url === url ? cached.fileId : url, caption: WELCOME, reply_markup: CONTACT_KEYBOARD,
      });
      const fileId = sent?.photo?.at(-1)?.file_id;
      if (fileId && cached?.fileId !== fileId) {
        const value = { url, fileId };
        await db.appSetting.upsert({ where: { key: "telegramWelcomePhoto" }, create: { key: "telegramWelcomePhoto", value }, update: { value } });
      }
      return;
    } catch (e) {
      console.error("[telegram] xush kelibsiz rasmi yuborilmadi:", e instanceof Error ? e.message : e);
    }
  }
  await tg("sendMessage", { chat_id: chatId, text: WELCOME, reply_markup: CONTACT_KEYBOARD });
}

/** Bitta yangilanishni qayta ishlash (polling va sinovlar uchun). */
export async function handleUpdate(u: TgUpdate): Promise<void> {
  if (u.message) {
    const m = u.message;
    if (m.contact) {
      if (!m.from || m.contact.user_id !== m.from.id) {
        await tg("sendMessage", { chat_id: m.chat.id, text: "Iltimos, faqat o'zingizning raqamingizni yuboring — pastdagi tugmani bosing.", reply_markup: CONTACT_KEYBOARD });
        return;
      }
      // Faqat shaxsiy chat: guruhga ulansa, tashkilot ma'lumotlari guruhdagi hammaga ko'rinib qolardi.
      if (m.chat.type && m.chat.type !== "private") {
        await tg("sendMessage", { chat_id: m.chat.id, text: "Botga faqat shaxsiy chatda ulanish mumkin." });
        return;
      }
      const chatId = String(m.chat.id);
      const phone = normalizePhone(m.contact.phone_number);
      const drivers = phone ? await db.driver.findMany({ where: { phone, status: "ACTIVE" }, include: { org: { select: { name: true, status: true } } } }) : [];
      const active = drivers.filter((d) => d.org.status === "ACTIVE");
      if (active.length) {
        await db.driver.updateMany({ where: { id: { in: active.map((d) => d.id) } }, data: { telegramChatId: chatId, telegramLinkedAt: new Date() } });
      }
      // Tashkilot xodimi (19.11.2026): hisob yoki a'zolik telefoni shu raqam bo'lsa.
      const staff = phone ? await linkStaff(chatId, phone) : [];
      if (!active.length && !staff.length) {
        await tg("sendMessage", {
          chat_id: m.chat.id,
          text: "😕 Bu raqam ReysPro'da topilmadi.\n\nRahbaringiz yoki menejeringizdan telefon raqamingizni tizimga to'g'ri kiritishini so'rang. Keyin /start ni qayta bosing.",
          reply_markup: { remove_keyboard: true },
        });
        return;
      }
      const who = [
        ...active.map((d) => `🚚 Haydovchi: ${d.fullName} (${d.org.name})`),
        ...staff.map((s) => `👤 ${s.roleTitle}: ${s.fullName} (${s.orgName})`),
      ];
      const help = [
        ...(active.length ? [`Endi yangi reys tayinlansa, shu yerga xabar keladi.\n${DRIVER_HELP}`] : []),
        ...(staff.length ? [STAFF_HELP] : []),
      ];
      await tg("sendMessage", {
        chat_id: m.chat.id,
        text: `✅ Siz ulandingiz!\n${who.join("\n")}\n\n${help.join("\n\n")}`,
        reply_markup: keyboardFor(active.length > 0, staff.length > 0),
      });
      return;
    }
    // Ovozli kiritish (21.11.2026): faqat xodim, faqat shaxsiy chat.
    const voice = m.voice ?? m.audio;
    if (voice) {
      if (m.chat.type && m.chat.type !== "private") return;
      const staff = await staffMembers(String(m.chat.id));
      if (staff.length) await staffVoice(m.chat.id, voice, staff);
      else if (await isDriverChat(String(m.chat.id))) await tg("sendMessage", { chat_id: m.chat.id, text: "Ovozli xabarni menejerga to'g'ridan-to'g'ri yuboring. Bot orqali — pastdagi tugmalar. 👇" });
      return;
    }
    const text = m.text?.trim();
    if (!text) return;
    const chatId = String(m.chat.id);
    const isDriver = await isDriverChat(chatId);
    if (isDriver && (text === BTN_TRIP || text === "/reys")) { await sendTrips(m.chat.id); return; }
    if (isDriver && (text === BTN_BALANCE || text === "/hisob")) { await sendBalance(m.chat.id); return; }
    if (isDriver && (text === BTN_DOCS || text === "/hujjat")) { await sendDocs(m.chat.id); return; }
    if (isDriver && (text === BTN_MANAGER || text === "/menejer")) { await sendManager(m.chat.id); return; }
    // Xodim (faqat shaxsiy chatda): tugmalar va qidiruv.
    const staff = !m.chat.type || m.chat.type === "private" ? await staffMembers(chatId) : [];
    if ((isDriver || staff.length) && (text === BTN_HELP || text === "/yordam")) { await sendHelp(m.chat.id, isDriver, staff.length > 0); return; }
    // «✏️ Tuzatish» bosilgan bo'lsa — matn qoralamani tuzatadi (tugma va buyruqlar emas).
    if (staff.length && !text.startsWith("/") && !STAFF_ROWS.flat().includes(text) && text !== BTN_HELP && (await staffVoiceText(m.chat.id, text, staff))) return;
    if (staff.length && !text.startsWith("/start") && (await staffText(m.chat.id, text, staff, keyboardFor(isDriver, true)))) return;
    if (text.startsWith("/start") && (isDriver || staff.length)) {
      const help = [...(isDriver ? [DRIVER_HELP] : []), ...(staff.length ? [STAFF_HELP] : [])];
      await tg("sendMessage", { chat_id: m.chat.id, text: `✅ Siz ulangansiz.\n\n${help.join("\n\n")}`, reply_markup: keyboardFor(isDriver, staff.length > 0) });
      return;
    }
    if (text.startsWith("/start")) {
      await rememberChat(m.chat);
      await sendWelcome(m.chat.id);
      return;
    }
    // Tanilmagan matn: faqat shaxsiy chatda javob beriladi (guruhdagi har xabarga emas).
    if (m.chat.type && m.chat.type !== "private") return;
    if (isDriver) {
      await tg("sendMessage", { chat_id: m.chat.id, text: "Kechirasiz, tushunmadim. Pastdagi tugmalardan foydalaning. 👇", reply_markup: await chatKeyboard(chatId, staff) });
      return;
    }
    if (!staff.length) {
      await tg("sendMessage", { chat_id: m.chat.id, text: "Botdan foydalanish uchun avval ulaning: pastdagi «📱 Telefon raqamni yuborish» tugmasini bosing.", reply_markup: CONTACT_KEYBOARD });
    }
    return;
  }
  const q = u.callback_query;
  if (q?.data && q.message) {
    if (q.data.startsWith("vd:")) {
      const staff = q.message.chat.type && q.message.chat.type !== "private" ? [] : await staffMembers(String(q.message.chat.id));
      if (!(await voiceCallback({ id: q.id, data: q.data, message: q.message }, staff))) await tg("answerCallbackQuery", { callback_query_id: q.id });
      return;
    }
    const ev = /^ev:([a-z0-9]+):([A-Z_]+)$/.exec(q.data);
    if (ev) {
      const chat = String(q.message.chat.id);
      const r = await driverEvent(chat, ev[1], ev[2]);
      await tg("answerCallbackQuery", { callback_query_id: q.id, text: r.ok ? "Belgilandi ✅" : r.text });
      const card = await tripCard(ev[1]);
      if (card && (r.ok || r.text !== "Bu reys sizga tegishli emas.")) {
        await tg("editMessageText", { chat_id: q.message.chat.id, message_id: q.message.message_id, text: card.text, reply_markup: card.markup ?? undefined }).catch(() => {});
      }
      return;
    }
    const mm = /^pm:([a-z0-9]+):(ok|no)$/.exec(q.data);
    if (!mm) { await tg("answerCallbackQuery", { callback_query_id: q.id }); return; }
    const move = await db.permitMove.findUnique({ where: { id: mm[1] }, include: { permit: { select: { number: true, type: true } } } });
    const chat = String(q.message.chat.id);
    if (!move || move.botChatId !== chat) {
      await tg("answerCallbackQuery", { callback_query_id: q.id, text: "Bu xabar sizga tegishli emas." });
      return;
    }
    const ack = mm[2] === "ok" ? "CONFIRMED" : "REJECTED";
    const done = await db.permitMove.updateMany({ where: { id: move.id, ack: "PENDING" }, data: { ack, ackAt: new Date() } });
    if (done.count !== 1) {
      await tg("answerCallbackQuery", { callback_query_id: q.id, text: "Javobingiz allaqachon qabul qilingan." });
      return;
    }
    await tg("answerCallbackQuery", { callback_query_id: q.id, text: ack === "CONFIRMED" ? "Tasdiqlandi" : "Rad etildi — menejer xabardor bo'ladi" });
    await tg("editMessageText", {
      chat_id: q.message.chat.id,
      message_id: q.message.message_id,
      text: `${q.message.text ?? ""}\n\n${ack === "CONFIRMED" ? "✅ Siz tasdiqladingiz." : "❌ Siz rad etdingiz. Menejer bilan bog'laning."}`,
    }).catch(() => {});
  }
}

/**
 * TIR/dazvol harakati (berildi / qaytarildi) haqida haydovchiga xabar. Bot ulanmagan bo'lsa — hech narsa
 * qilinmaydi (ack null qoladi, sahifada "bot ulanmagan" ko'rinadi). Xato asosiy amalni to'xtatmaydi.
 */
export async function notifyDriverMove(moveId: string): Promise<void> {
  try {
    if (!botToken()) return;
    const move = await db.permitMove.findUnique({ where: { id: moveId }, include: { permit: true } });
    if (!move || !move.driverId || (move.kind !== "ISSUED" && move.kind !== "RETURNED")) return;
    const driver = await db.driver.findUnique({ where: { id: move.driverId }, include: { org: { select: { name: true } } } });
    if (!driver?.telegramChatId) return;
    const p = move.permit;
    const what = `${TYPE_UZ[p.type]}${p.format === "ELECTRONIC" ? " (elektron)" : p.format === "PAPER" ? " (qog'oz)" : ""} № ${p.number}${p.country ? `, ${p.country}` : ""}`;
    const text = move.kind === "ISSUED"
      ? `📄 Sizga ${what} berildi.\nTyagach: ${move.plate ?? "—"}\nSana: ${formatDate(move.date)}\nAmal qilish muddati: ${formatDate(p.validUntil)}\nTashkilot: ${driver.org.name}\n\nOldingizmi?`
      : `📥 Siz ${what} ni tashkilotga topshirdingiz.\nSana: ${formatDate(move.date)}${move.used === null ? "" : `\nHolati: ${move.used ? "ishlatilgan" : "ishlatilmagan"}`}\nTashkilot: ${driver.org.name}\n\nTo'g'rimi?`;
    const [yes, no] = move.kind === "ISSUED" ? ["✅ Ha, oldim", "❌ Yo'q, olmadim"] : ["✅ Ha, topshirdim", "❌ Yo'q"];
    const sent = await tg<{ message_id: number }>("sendMessage", {
      chat_id: driver.telegramChatId,
      text,
      reply_markup: { inline_keyboard: [[{ text: yes, callback_data: `pm:${move.id}:ok` }, { text: no, callback_data: `pm:${move.id}:no` }]] },
    });
    await db.permitMove.update({ where: { id: move.id }, data: { ack: "PENDING", botChatId: driver.telegramChatId, botMessageId: sent.message_id } });
  } catch (e) {
    console.error("Haydovchiga Telegram xabari yuborilmadi:", e);
  }
}

const g = globalThis as unknown as { reysproPolling?: boolean };

/** getUpdates (long polling). Bitta server jarayonida bir marta ishga tushadi. */
export function startPolling() {
  if (g.reysproPolling || !botToken()) return;
  g.reysproPolling = true;
  void (async () => {
    try {
      const me = await tg<{ username: string }>("getMe", {});
      await db.appSetting.upsert({ where: { key: "telegramBot" }, create: { key: "telegramBot", value: me.username }, update: { value: me.username } });
      await tg("deleteWebhook", {});
      await syncBotProfile();
      console.log(`[telegram] bot @${me.username} ishga tushdi (polling)`);
    } catch (e) {
      console.error("[telegram] bot ishga tushmadi:", e);
    }
    let offset = 0;
    for (;;) {
      try {
        const updates = await tg<TgUpdate[]>("getUpdates", { offset, timeout: 50, allowed_updates: ["message", "callback_query"] }, 65_000);
        for (const u of updates) {
          offset = u.update_id + 1;
          // Ovozli xabar (AI) bir necha soniya oladi — boshqa xabarlarni kutdirmaslik uchun fonda.
          const job = handleUpdate(u).catch((e) => console.error("[telegram] yangilanish xatosi:", e));
          if (!u.message?.voice && !u.message?.audio) await job;
        }
      } catch (e) {
        const code = (e as { code?: number }).code;
        console.error("[telegram] polling xatosi:", e instanceof Error ? e.message : e);
        await new Promise((r) => setTimeout(r, code === 409 ? 30_000 : 5_000));
      }
    }
  })();
}
