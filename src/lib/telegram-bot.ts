/**
 * ReysPro Telegram boti (17.11.2026). "server-only" import qilinmaydi: instrumentation.ts dan ham ishga tushadi.
 *
 * - Haydovchi botga /start yozadi va "Telefon raqamni yuborish" tugmasini bosadi. Telegram o'zining raqamini
 *   yuborgan bo'lsa (contact.user_id === from.id), shu raqamli faol haydovchilarga chat bog'lanadi.
 * - TIR/dazvol haydovchiga berilganda yoki u qaytarganda xabar boradi: "Tasdiqlash" / "Rad etish" tugmalari.
 *   Javob faqat xabar yuborilgan chatdan qabul qilinadi.
 * - Server lokal tarmoqda (ochiq HTTPS manzil yo'q), shuning uchun webhook emas — getUpdates (long polling).
 */
import { db } from "./db";
import { normalizePhone } from "./phone";
import { formatDate } from "./dates";
import type { TripEventType } from "@prisma/client";
import { EVENT_ORDER, checkEvent, completesTrip, nextEvents } from "./trips-core";

type TgChat = { id: number; first_name?: string; last_name?: string; username?: string; title?: string };
type TgUpdate = {
  update_id: number;
  message?: { message_id: number; chat: TgChat; from?: { id: number }; text?: string; contact?: { phone_number: string; user_id?: number } };
  callback_query?: { id: string; from: { id: number }; data?: string; message?: { message_id: number; chat: TgChat; text?: string } };
};

export function apiBase(): string {
  return (process.env.TELEGRAM_API_URL || "https://api.telegram.org").replace(/\/+$/, "");
}

export function botToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
}

export async function tg<T = unknown>(method: string, body: unknown, timeoutMs = 10_000): Promise<T> {
  const token = botToken();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN sozlanmagan");
  const res = await fetch(`${apiBase()}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string; error_code?: number };
  if (!json.ok) throw Object.assign(new Error(json.description || `Telegram xatosi ${res.status}`), { code: json.error_code });
  return json.result as T;
}

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
const MAIN_KEYBOARD = { keyboard: [[{ text: BTN_TRIP }, { text: BTN_BALANCE }]], resize_keyboard: true, is_persistent: true };

const EV_UZ: Record<string, string> = {
  ACCEPTED: "Qabul qildim", ARRIVED_LOADING: "Yuklashga yetdim", LOADED: "Yuklandi", ARRIVED_UNLOADING: "Tushirishga yetdim", UNLOADED: "Tushirildi",
};
const EV_DONE_UZ: Record<string, string> = {
  ACCEPTED: "Qabul qilindi", ARRIVED_LOADING: "Yuklashga yetdi", LOADED: "Yuklandi", ARRIVED_UNLOADING: "Tushirishga yetdi", UNLOADED: "Tushirildi",
};
const tripNo = (n: number) => `TSH-${String(n).padStart(4, "0")}`;
const fmtTime = (d: Date) => {
  const t = new Date(d.getTime() + 5 * 3_600_000).toISOString();
  return `${t.slice(8, 10)}.${t.slice(5, 7)} ${t.slice(11, 16)}`;
};

/** Reys haqida matn va keyingi bosqich tugmasi. */
async function tripCard(tripId: string): Promise<{ text: string; markup?: unknown } | null> {
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    include: { tractor: { select: { plate: true } }, trailer: { select: { plate: true } }, events: { orderBy: { at: "asc" } }, org: { select: { name: true } } },
  });
  if (!trip) return null;
  const done = Object.fromEntries(trip.events.map((e) => [e.type, e.at]));
  const steps = EVENT_ORDER.map((s) => (done[s] ? `✅ ${EV_DONE_UZ[s]} — ${fmtTime(done[s] as Date)}` : `▫️ ${EV_DONE_UZ[s]}`));
  const head = `🚚 ${tripNo(trip.number)}: ${trip.routeFrom} → ${trip.routeTo}\nYuklash sanasi: ${formatDate(trip.loadDate)}\nTyagach: ${trip.tractor.plate}${trip.trailer ? `, prisep: ${trip.trailer.plate}` : ""}${trip.cargo ? `\nYuk: ${trip.cargo}` : ""}\n${trip.org.name}`;
  if (trip.status !== "ACTIVE") return { text: `${head}\n\n${steps.join("\n")}\n\n${trip.status === "COMPLETED" ? "🏁 Reys yakunlangan." : "❌ Reys bekor qilingan."}` };
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
    await tg("sendMessage", { chat_id: chat, text: `🆕 Sizga yangi reys tayinlandi.\n\n${card.text}`, reply_markup: card.markup ?? MAIN_KEYBOARD });
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
    await tg("sendMessage", { chat_id: chatId, text: "Hozir sizda faol reys yo'q.", reply_markup: MAIN_KEYBOARD });
    return;
  }
  for (const t of trips) {
    const card = await tripCard(t.id);
    if (card) await tg("sendMessage", { chat_id: chatId, text: card.text, reply_markup: card.markup ?? MAIN_KEYBOARD });
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
  await tg("sendMessage", { chat_id: chatId, text: `💰 Hisobingiz\n${parts.join("\n")}`, reply_markup: MAIN_KEYBOARD });
}

/** Bitta yangilanishni qayta ishlash (polling va sinovlar uchun). */
export async function handleUpdate(u: TgUpdate): Promise<void> {
  if (u.message) {
    const m = u.message;
    if (m.contact) {
      if (!m.from || m.contact.user_id !== m.from.id) {
        await tg("sendMessage", { chat_id: m.chat.id, text: "Faqat o'zingizning raqamingizni yuboring — pastdagi tugmani bosing.", reply_markup: CONTACT_KEYBOARD });
        return;
      }
      const phone = normalizePhone(m.contact.phone_number);
      const drivers = phone ? await db.driver.findMany({ where: { phone, status: "ACTIVE" }, include: { org: { select: { name: true, status: true } } } }) : [];
      const active = drivers.filter((d) => d.org.status === "ACTIVE");
      if (!active.length) {
        await tg("sendMessage", {
          chat_id: m.chat.id,
          text: "Bu raqam ReysPro'da haydovchi sifatida topilmadi. Menejeringizdan telefon raqamingizni to'g'ri kiritishini so'rang, keyin qayta /start bosing.",
          reply_markup: { remove_keyboard: true },
        });
        return;
      }
      await db.driver.updateMany({ where: { id: { in: active.map((d) => d.id) } }, data: { telegramChatId: String(m.chat.id), telegramLinkedAt: new Date() } });
      await tg("sendMessage", {
        chat_id: m.chat.id,
        text: `✅ Siz ReysPro'ga ulandingiz: ${active.map((d) => `${d.fullName} (${d.org.name})`).join(", ")}.\nEndi yangi reys, TIR va dazvol, hisob-kitob haqida shu yerga xabar keladi.\n\n«${BTN_TRIP}» — reys bosqichlarini belgilash, «${BTN_BALANCE}» — hisob-kitob.`,
        reply_markup: MAIN_KEYBOARD,
      });
      return;
    }
    const linked = m.text && (await db.driver.count({ where: { telegramChatId: String(m.chat.id), status: "ACTIVE" } })) > 0;
    if (linked && (m.text === BTN_TRIP || m.text === "/reys")) { await sendTrips(m.chat.id); return; }
    if (linked && (m.text === BTN_BALANCE || m.text === "/hisob")) { await sendBalance(m.chat.id); return; }
    if (m.text?.startsWith("/start") && linked) {
      await tg("sendMessage", { chat_id: m.chat.id, text: `Siz ulangansiz.\n«${BTN_TRIP}» — reys bosqichlari, «${BTN_BALANCE}» — hisob-kitob.`, reply_markup: MAIN_KEYBOARD });
      return;
    }
    if (m.text?.startsWith("/start")) {
      await rememberChat(m.chat);
      await tg("sendMessage", {
        chat_id: m.chat.id,
        text: "Assalomu alaykum! Bu ReysPro boti.\nHaydovchi bo'lsangiz, ulanish uchun pastdagi «Telefon raqamni yuborish» tugmasini bosing.",
        reply_markup: CONTACT_KEYBOARD,
      });
      return;
    }
    return;
  }
  const q = u.callback_query;
  if (q?.data && q.message) {
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
          await handleUpdate(u).catch((e) => console.error("[telegram] yangilanish xatosi:", e));
        }
      } catch (e) {
        const code = (e as { code?: number }).code;
        console.error("[telegram] polling xatosi:", e instanceof Error ? e.message : e);
        await new Promise((r) => setTimeout(r, code === 409 ? 30_000 : 5_000));
      }
    }
  })();
}
