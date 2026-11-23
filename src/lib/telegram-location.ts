/**
 * Haydovchi joylashuvi Telegram orqali (23.11.2026). "server-only" import qilinmaydi: bot instrumentation.ts dan ishlaydi.
 *
 * - Kuzatuv har haydovchi uchun alohida yoqiladi (Driver.trackLocation, haydovchi kartochkasida). Hamma haydovchi shart emas.
 * - Haydovchi Telegram'da 📎 → Joylashuv → «Jonli joylashuvni ulashish» → «Men o'chirgunimcha» ni tanlaydi.
 *   Telegram har harakatda xabarni tahrirlaydi (edited_message) — bot oxirgi nuqtani saqlaydi, tarixga esa
 *   5 daqiqada yoki 1 km da bir nuqta yozadi.
 * - Ulashish to'xtasa (yoki 6 soat yangilanmasa) va faol reysi bo'lsa — bot 3 soatda bir eslatadi (8:00–22:00).
 * - Kuzatuv yoqilmagan haydovchining joylashuvi saqlanmaydi.
 */
import { db } from "./db";
import { tg } from "./telegram-common";
import { KEEP_DAYS, LIVE_FOREVER, liveUntilFrom, locState, needsReminder, shouldStore, validPoint } from "./location-core";

export type TgLocation = { latitude: number; longitude: number; live_period?: number; horizontal_accuracy?: number };

export const BTN_LOCATION = "📍 Joylashuv";

export const LOCATION_HOWTO =
  "📍 Joylashuvni yoqish (bir marta qilinadi):\n" +
  "1) Shu chatda pastdagi 📎 (qisqich) belgisini bosing.\n" +
  "2) «Joylashuv» (Геопозиция / Location) ni tanlang.\n" +
  "3) «Jonli joylashuvni ulashish» (Транслировать геопозицию / Share Live Location) ni bosing.\n" +
  "4) Muddatni «Men o'chirgunimcha» (Пока не выключу / Until I turn it off) qilib tanlang.\n\n" +
  "Telefonda GPS (joylashuv) yoqiq bo'lsin va Telegram'ga joylashuvga «doim» ruxsat bering. " +
  "Joylashuvingizni faqat tashkilotingiz menejerlari ko'radi.";

/** Shu chatga ulangan, kuzatuvi yoqilgan faol haydovchilar (bir kishi bir necha tashkilotda bo'lishi mumkin). */
export async function trackedDrivers(chatId: string) {
  return db.driver.findMany({
    where: { telegramChatId: chatId, status: "ACTIVE", trackLocation: true, org: { status: "ACTIVE" } },
    select: { id: true, orgId: true },
  });
}

export async function isTrackedChat(chatId: string): Promise<boolean> {
  return (await trackedDrivers(chatId)).length > 0;
}

/**
 * Joylashuv xabari (yangi yoki tahrirlangan). Javob qaytaradi: haydovchiga yuboriladigan matn (yoki null — jim).
 * `edited` — Telegram jonli joylashuvni yangilagan; `sentAt` — asl xabar vaqti (Telegram `date`, soniya).
 */
export async function saveLocation(chatId: string, loc: TgLocation, opts: { edited: boolean; sentAt?: number; now?: Date }): Promise<string | null> {
  const now = opts.now ?? new Date();
  if (!validPoint(loc.latitude, loc.longitude)) return null;
  const drivers = await trackedDrivers(chatId);
  if (!drivers.length) {
    if (opts.edited) return null;
    const isDriver = await db.driver.count({ where: { telegramChatId: chatId, status: "ACTIVE" } });
    return isDriver ? "Sizda joylashuv kuzatuvi yoqilmagan, joylashuvingiz saqlanmadi. Kerak bo'lsa, menejeringiz yoqadi." : null;
  }
  const lat = loc.latitude;
  const lng = loc.longitude;
  // Jonli ulashish: yangi xabarda live_period bor; tahrirda live_period yo'q bo'lsa — haydovchi to'xtatgan.
  let liveUntil: Date | null | undefined;
  if (loc.live_period) liveUntil = liveUntilFrom(opts.sentAt ?? Math.floor(now.getTime() / 1000), loc.live_period);
  else if (opts.edited) liveUntil = now;
  for (const d of drivers) {
    const prev = await db.driverLocation.findFirst({ where: { driverId: d.id }, orderBy: { at: "desc" }, select: { lat: true, lng: true, at: true } });
    await db.$transaction([
      db.driver.update({
        where: { id: d.id },
        data: { lastLat: lat, lastLng: lng, lastLocAt: now, ...(liveUntil !== undefined ? { liveUntil } : {}) },
      }),
      ...(shouldStore(prev, { lat, lng }, now) ? [db.driverLocation.create({ data: { orgId: d.orgId, driverId: d.id, lat, lng, at: now } })] : []),
    ]);
  }
  if (opts.edited) return liveUntil && liveUntil.getTime() <= now.getTime() ? "📍 Jonli joylashuv to'xtatildi. Yana yoqish uchun «📍 Joylashuv» tugmasini bosing." : null;
  if (!loc.live_period) return `📍 Hozirgi joyingiz qabul qilindi.\n\nMenejer doim ko'rib turishi uchun jonli joylashuvni yoqing:\n\n${LOCATION_HOWTO}`;
  const short = loc.live_period < 8 * 3600 && loc.live_period !== LIVE_FOREVER;
  return `✅ Jonli joylashuv qabul qilindi. Rahmat! Menejeringiz xaritada ko'radi.${short ? "\n\nℹ️ Siz qisqa muddat tanladingiz. Keyingi safar «Men o'chirgunimcha» ni tanlang — har safar qayta yoqish shart bo'lmaydi." : ""}`;
}

/** «📍 Joylashuv» tugmasi: holat va yo'riqnoma. */
export async function locationStatusText(chatId: string): Promise<string> {
  const drivers = await db.driver.findMany({
    where: { telegramChatId: chatId, status: "ACTIVE", trackLocation: true },
    select: { lastLocAt: true, liveUntil: true },
  });
  if (!drivers.length) return "Sizda joylashuv kuzatuvi yoqilmagan.";
  const now = new Date();
  const states = drivers.map((d) => locState(d, now));
  if (states.includes("LIVE")) return `✅ Jonli joylashuvingiz yoqiq — menejer ko'rib turibdi. Rahmat!\n\nAgar o'chirib qo'ygan bo'lsangiz, qayta yoqing:\n\n${LOCATION_HOWTO}`;
  if (states.includes("STALE")) return `⚠️ Joylashuvingiz uzoq vaqtdan beri yangilanmayapti. Telefonda internet va GPS yoqiqligini tekshiring yoki qayta yoqing:\n\n${LOCATION_HOWTO}`;
  return LOCATION_HOWTO;
}

/** Menejer kuzatuvni yoqdi/o'chirdi — haydovchiga xabar (bot ulangan bo'lsa). Xato asosiy amalni to'xtatmaydi. */
export async function notifyTrackingChanged(driverId: string, on: boolean): Promise<void> {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) return;
    const d = await db.driver.findUnique({ where: { id: driverId }, select: { telegramChatId: true, status: true, org: { select: { name: true } } } });
    if (!d?.telegramChatId || d.status !== "ACTIVE") return;
    const text = on
      ? `📍 ${d.org.name} sizga joylashuv kuzatuvini yoqdi: menejer yuk va yo'lni rejalashtirish uchun mashinangiz qayerdaligini ko'radi.\n\n${LOCATION_HOWTO}`
      : `📍 ${d.org.name} joylashuv kuzatuvini o'chirdi. Endi joylashuvingiz saqlanmaydi — Telegram'da jonli joylashuvni to'xtatishingiz mumkin.`;
    await tg("sendMessage", { chat_id: d.telegramChatId, text });
  } catch (e) {
    console.error("[telegram] joylashuv xabari yuborilmadi:", e instanceof Error ? e.message : e);
  }
}

/** Eslatmalar: ulashish to'xtagan, faol reysdagi kuzatiladigan haydovchilarga. Bir chatga bitta xabar. */
export async function sendLocationReminders(now = new Date()): Promise<number> {
  const drivers = await db.driver.findMany({
    where: { trackLocation: true, status: "ACTIVE", telegramChatId: { not: null }, org: { status: "ACTIVE" } },
    select: {
      id: true, telegramChatId: true, trackLocation: true, lastLocAt: true, liveUntil: true, locRemindedAt: true,
      trips: { where: { status: "ACTIVE" }, select: { id: true }, take: 1 },
    },
  });
  const due = drivers.filter((d) => needsReminder({ ...d, hasActiveTrip: d.trips.length > 0 }, now));
  const chats = new Map<string, string[]>();
  for (const d of due) chats.set(d.telegramChatId!, [...(chats.get(d.telegramChatId!) ?? []), d.id]);
  let sent = 0;
  for (const [chat, ids] of chats) {
    // Avval belgilanadi: Telegram xatosi bo'lsa ham har 15 daqiqada qayta urinmaslik uchun.
    await db.driver.updateMany({ where: { id: { in: ids } }, data: { locRemindedAt: now } });
    const stale = due.some((d) => ids.includes(d.id) && locState(d, now) === "STALE");
    const head = stale
      ? "⚠️ Joylashuvingiz uzoq vaqtdan beri yangilanmayapti. Telefonda internet va GPS yoqiqligini tekshiring."
      : "📍 Jonli joylashuvingiz o'chiq. Reys davomida yoqib qo'ying — menejer qayerdaligingizni ko'rib turadi.";
    try {
      await tg("sendMessage", { chat_id: chat, text: `${head}\n\n${LOCATION_HOWTO}` });
      sent++;
    } catch (e) {
      console.error("[telegram] joylashuv eslatmasi yuborilmadi:", e instanceof Error ? e.message : e);
    }
  }
  return sent;
}

/** Eski tarixni o'chirish (180 kun). */
export async function pruneLocations(now = new Date()): Promise<number> {
  const r = await db.driverLocation.deleteMany({ where: { at: { lt: new Date(now.getTime() - KEEP_DAYS * 86_400_000) } } });
  return r.count;
}

const g = globalThis as unknown as { reysproLocationJobs?: boolean };

/** Har 15 daqiqada eslatmalar, kuniga bir marta eski tarixni tozalash. */
export function startLocationJobs() {
  if (g.reysproLocationJobs) return;
  g.reysproLocationJobs = true;
  let lastPrune = 0;
  const run = async () => {
    try {
      await sendLocationReminders();
      if (Date.now() - lastPrune > 86_400_000) {
        lastPrune = Date.now();
        await pruneLocations();
      }
    } catch (e) {
      console.error("[joylashuv] fon vazifasi xatosi:", e instanceof Error ? e.message : e);
    }
  };
  setTimeout(run, 60_000);
  setInterval(run, 15 * 60_000);
}
