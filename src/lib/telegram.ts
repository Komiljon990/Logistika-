import "server-only";
import { getSetting } from "./settings";

/**
 * Super Admin Telegram botiga xabar (yangi ariza, kvitansiya yuklandi).
 * Bot tokeni .env'da (TELEGRAM_BOT_TOKEN — maxfiy), chat id Super Admin sozlamalarida (yoki TELEGRAM_ADMIN_CHAT_ID).
 * Sozlanmagan yoki Telegram javob bermasa — jim o'tadi (asosiy amal to'xtamaydi), serverda logga yoziladi.
 */
export function botToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
}

export async function adminChatId(): Promise<string | null> {
  return (await getSetting<string>("telegramChatId")) || process.env.TELEGRAM_ADMIN_CHAT_ID?.trim() || null;
}

async function call(method: string, body: unknown) {
  const token = botToken();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN sozlanmagan");
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const json = (await res.json()) as { ok: boolean; result?: unknown; description?: string };
  if (!json.ok) throw new Error(json.description || `Telegram xatosi ${res.status}`);
  return json.result;
}

export async function sendTelegram(chatId: string, text: string) {
  await call("sendMessage", { chat_id: chatId, text, disable_web_page_preview: true });
}

export async function notifyAdmin(text: string): Promise<boolean> {
  try {
    const chat = await adminChatId();
    if (!botToken() || !chat) {
      console.log(`[telegram sozlanmagan] ${text}`);
      return false;
    }
    await sendTelegram(chat, text);
    return true;
  } catch (e) {
    console.error("Telegram xabari yuborilmadi:", e);
    return false;
  }
}

/** Botga oxirgi yozgan chatlar (chat id'ni aniqlash uchun): Super Admin botga /start yozadi, keyin shu ro'yxatdan tanlaydi. */
export async function recentChats(): Promise<{ id: string; name: string }[]> {
  const updates = (await call("getUpdates", { limit: 50 })) as { message?: { chat: { id: number; first_name?: string; last_name?: string; username?: string; title?: string } } }[];
  const map = new Map<string, string>();
  for (const u of updates) {
    const c = u.message?.chat;
    if (c) map.set(String(c.id), [c.title, c.first_name, c.last_name, c.username ? `@${c.username}` : ""].filter(Boolean).join(" "));
  }
  return [...map].map(([id, name]) => ({ id, name }));
}
