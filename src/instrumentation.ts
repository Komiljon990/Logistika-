/** Server ishga tushganda: Telegram bot (token bo'lsa; sinov serverida TELEGRAM_POLLING=off). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_POLLING !== "off") {
    const { startPolling } = await import("./lib/telegram-bot");
    startPolling();
  }
  // 18.11.2026: ijarachilarga oylik a'zolik avtomatik (kartochkasida summa bo'lsa). Sinov serverida AUTO_JOBS=off.
  if (process.env.AUTO_JOBS !== "off") {
    const { startLedgerScheduler } = await import("./lib/driver-ledger");
    startLedgerScheduler();
    // 19.11.2026: botga ulangan xodimlarga har kuni 9:00 da ogohlantirishlar (token bo'lsa).
    if (process.env.TELEGRAM_BOT_TOKEN) {
      const { startStaffDigest } = await import("./lib/telegram-staff");
      startStaffDigest();
    }
  }
}
