/**
 * Telegram bot uchun umumiy qism (19.11.2026): API chaqiruvi, reys bosqichlari nomlari, vaqt formati.
 * Haydovchi qismi (telegram-bot.ts) va xodim qismi (telegram-staff.ts) shu yerdan oladi — o'zaro aylana import bo'lmasin.
 * "server-only" import qilinmaydi: bot instrumentation.ts dan ishga tushadi.
 */

export function apiBase(): string {
  return (process.env.TELEGRAM_API_URL || "https://api.telegram.org").replace(/\/+$/, "");
}

export function botToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
}

export async function tg<T = unknown>(method: string, body: unknown, timeoutMs = 10_000): Promise<T> {
  const token = botToken();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN sozlanmagan");
  return tgWith<T>(token, method, body, timeoutMs);
}

/** Super Admin boti (23.11.2026) — alohida bot, alohida token (SUPERADMIN_BOT_TOKEN). */
export function adminBotToken(): string | null {
  return process.env.SUPERADMIN_BOT_TOKEN?.trim() || null;
}

/** Istalgan bot tokeni bilan Telegram API chaqiruvi. */
export async function tgWith<T = unknown>(token: string, method: string, body: unknown, timeoutMs = 10_000): Promise<T> {
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

/** Haydovchi tugmasidagi matn (buyruq shaklida). */
export const EV_UZ: Record<string, string> = {
  ACCEPTED: "Qabul qildim", ARRIVED_LOADING: "Yuklashga yetdim", LOADED: "Yuklandi", ARRIVED_UNLOADING: "Tushirishga yetdim", UNLOADED: "Tushirildi",
};
/** Bajarilgan bosqich nomi. */
export const EV_DONE_UZ: Record<string, string> = {
  ACCEPTED: "Qabul qilindi", ARRIVED_LOADING: "Yuklashga yetdi", LOADED: "Yuklandi", ARRIVED_UNLOADING: "Tushirishga yetdi", UNLOADED: "Tushirildi",
};

/** Toshkent vaqti: "19.11 14:20". */
export function fmtTime(d: Date): string {
  const t = new Date(d.getTime() + 5 * 3_600_000).toISOString();
  return `${t.slice(8, 10)}.${t.slice(5, 7)} ${t.slice(11, 16)}`;
}

/** Telegram HTML rejimi uchun matnni xavfsiz qilish. */
export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Dastur sahifasiga havola (APP_URL yoki CRM_URL bo'lsa), aks holda oddiy matn. */
export function appLink(href: string, label: string): string {
  const base = (process.env.APP_URL || process.env.CRM_URL || "").trim().replace(/\/+$/, "");
  return base ? `<a href="${esc(base + href).replace(/"/g, "&quot;")}">${esc(label)}</a>` : esc(label);
}

/** Telegram xabari 4096 belgidan oshmasin. */
export function clip(text: string, max = 3900): string {
  return text.length <= max ? text : `${text.slice(0, max)}\n…`;
}
