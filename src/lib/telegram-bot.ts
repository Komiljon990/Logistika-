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
        text: `✅ Siz ReysPro'ga ulandingiz: ${active.map((d) => `${d.fullName} (${d.org.name})`).join(", ")}.\nEndi TIR va dazvol berilganda yoki topshirilganda shu yerga xabar keladi.`,
        reply_markup: { remove_keyboard: true },
      });
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
    const what = `${TYPE_UZ[p.type]} № ${p.number}${p.country ? ` (${p.country})` : ""}`;
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
