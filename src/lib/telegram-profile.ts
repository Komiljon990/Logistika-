/**
 * Bot profili (19.11.2026): buyruqlar ro'yxati, qisqa va to'liq tavsif — bot ishga tushganda Telegram'ga yoziladi,
 * BotFather'da qo'lda kiritish shart emas. Bot rasmi (avatar) va tavsif rasmi faqat BotFather orqali qo'yiladi.
 * Matnlar: /mnt/project-files/logistika/bot/bot-matnlari.md bilan bir xil. Standart til — o'zbekcha, rus tilidagi
 * Telegram foydalanuvchilariga — ruscha.
 * "server-only" import qilinmaydi: bot instrumentation.ts dan ishga tushadi.
 */
import { db } from "./db";
import { tg } from "./telegram-common";

export const BOT_COMMANDS: { command: string; description: string }[] = [
  { command: "start", description: "Botni ishga tushirish va ulanish" },
  { command: "reys", description: "Mening reysim (haydovchi)" },
  { command: "hisob", description: "Mening hisobim (haydovchi)" },
  { command: "hujjat", description: "Qo'limdagi TIR/dazvol (haydovchi)" },
  { command: "menejer", description: "Menejer bilan bog'lanish (haydovchi)" },
  { command: "joylashuv", description: "Jonli joylashuvni yoqish (haydovchi)" },
  { command: "bugun", description: "Bugungi holat (xodim)" },
  { command: "reyslar", description: "Faol reyslar (xodim)" },
  { command: "ogohlantirish", description: "Ogohlantirishlar (xodim)" },
  { command: "qidiruv", description: "Qidiruv (xodim)" },
  { command: "yordam", description: "Yordam" },
];

const BOT_COMMANDS_RU: { command: string; description: string }[] = [
  { command: "start", description: "Запустить бота и подключиться" },
  { command: "reys", description: "Мой рейс (водитель)" },
  { command: "hisob", description: "Мои расчёты (водитель)" },
  { command: "hujjat", description: "TIR/дозволы на руках (водитель)" },
  { command: "menejer", description: "Связаться с менеджером (водитель)" },
  { command: "joylashuv", description: "Включить трансляцию геопозиции (водитель)" },
  { command: "bugun", description: "Сводка за день (сотрудник)" },
  { command: "reyslar", description: "Активные рейсы (сотрудник)" },
  { command: "ogohlantirish", description: "Предупреждения (сотрудник)" },
  { command: "qidiruv", description: "Поиск (сотрудник)" },
  { command: "yordam", description: "Помощь" },
];

export const SHORT_DESCRIPTION = "ReysPro — yuk tashish tashkilotlari uchun: reys bosqichlari, hisob-kitob, TIR/dazvol. reyspro.uz";
const SHORT_DESCRIPTION_RU = "ReysPro — для транспортных компаний: этапы рейса, расчёты, TIR/дозволы. reyspro.uz";

export const DESCRIPTION = `ReysPro — logistika tashkilotlarining rasmiy boti.

🚚 Haydovchilar: reys bosqichlarini bir tugma bilan belgilash, hisob-kitobni ko'rish, TIR/dazvol berilganini tasdiqlash.

👤 Rahbar, menejer, buxgalter: bugungi holat, faol reyslar, ogohlantirishlar, tezkor qidiruv, kirim xabarlari.

Ulanish uchun «Start» ni bosing va telefon raqamingizni yuboring. Raqamingiz tashkilotingizda kiritilgan bo'lishi kerak.

Sayt: reyspro.uz`;

const DESCRIPTION_RU = `ReysPro — официальный бот логистических компаний.

🚚 Водителям: отмечать этапы рейса одной кнопкой, смотреть расчёты, подтверждать получение TIR/дозвола.

👤 Руководителю, менеджеру, бухгалтеру: сводка за день, активные рейсы, предупреждения, быстрый поиск, уведомления о поступлениях.

Нажмите «Start» и отправьте свой номер телефона. Номер должен быть внесён в вашей компании.

Сайт: reyspro.uz`;

/** Profil versiyasi: matn o'zgarsa oshiriladi, shunda keyingi ishga tushishda Telegram'ga qayta yoziladi. */
const PROFILE_VERSION = "2026-11-23";

/**
 * Buyruqlar va tavsifni Telegram'ga yozadi (faqat versiya o'zgarganda — har ishga tushishda emas).
 * Xato bot ishini to'xtatmaydi.
 */
export async function syncBotProfile(): Promise<void> {
  try {
    const row = await db.appSetting.findUnique({ where: { key: "telegramProfile" } });
    if (row?.value === PROFILE_VERSION) return;
    await tg("setMyCommands", { commands: BOT_COMMANDS });
    await tg("setMyCommands", { commands: BOT_COMMANDS_RU, language_code: "ru" });
    await tg("setMyShortDescription", { short_description: SHORT_DESCRIPTION });
    await tg("setMyShortDescription", { short_description: SHORT_DESCRIPTION_RU, language_code: "ru" });
    await tg("setMyDescription", { description: DESCRIPTION });
    await tg("setMyDescription", { description: DESCRIPTION_RU, language_code: "ru" });
    await db.appSetting.upsert({ where: { key: "telegramProfile" }, create: { key: "telegramProfile", value: PROFILE_VERSION }, update: { value: PROFILE_VERSION } });
    console.log("[telegram] bot buyruqlari va tavsifi yangilandi");
  } catch (e) {
    console.error("[telegram] bot profili yangilanmadi:", e instanceof Error ? e.message : e);
  }
}
