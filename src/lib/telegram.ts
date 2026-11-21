import "server-only";
import { getSetting } from "./settings";
import { botToken, tg } from "./telegram-bot";

export { botToken };

/**
 * Super Admin Telegram botiga xabar (yangi ariza, kvitansiya yuklandi).
 * Bot tokeni .env'da (TELEGRAM_BOT_TOKEN — maxfiy), chat id Super Admin sozlamalarida (yoki TELEGRAM_ADMIN_CHAT_ID).
 * Sozlanmagan yoki Telegram javob bermasa — jim o'tadi (asosiy amal to'xtamaydi), serverda logga yoziladi.
 */
export async function adminChatId(): Promise<string | null> {
  return (await getSetting<string>("telegramChatId")) || process.env.TELEGRAM_ADMIN_CHAT_ID?.trim() || null;
}

export async function sendTelegram(chatId: string, text: string) {
  await tg("sendMessage", { chat_id: chatId, text, disable_web_page_preview: true });
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

/**
 * Botga oxirgi /start yozgan chatlar (chat id'ni aniqlash uchun). Bot doimiy ishlab turgani (getUpdates) uchun
 * ro'yxatni bot o'zi saqlaydi — bu yerda faqat o'qiladi.
 */
export async function recentChats(): Promise<{ id: string; name: string }[]> {
  return ((await getSetting<{ id: string; name: string }[]>("telegramChats")) ?? []).map(({ id, name }) => ({ id, name }));
}

export async function botUsername(): Promise<string | null> {
  return getSetting<string>("telegramBot");
}
