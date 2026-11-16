/** Server ishga tushganda: Telegram bot (token bo'lsa; sinov serverida TELEGRAM_POLLING=off). */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_POLLING !== "off") {
    const { startPolling } = await import("./lib/telegram-bot");
    startPolling();
  }
}
