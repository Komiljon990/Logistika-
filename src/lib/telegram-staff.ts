/**
 * Telegram bot — tashkilot xodimlari uchun (19.11.2026). Bu qism faqat KO'RSATADI, hech narsani o'zgartirmaydi.
 * (21.11.2026: ovozli kiritish — telegram-voice.ts; u ham faqat xodim tasdiqlagandan keyin yozadi.)
 *
 * - Ulanish: xodim /start → "Telefon raqamni yuborish". Raqam hisob (Account.phone) yoki faol a'zolik (User.phone)
 *   telefoniga mos kelsa, chat hisobga bog'lanadi. Telefon o'zgarsa, a'zolik bloklansa yoki tashkilot nofaol bo'lsa —
 *   har so'rovda qayta tekshiriladi, bog'lanish o'z-o'zidan bekor bo'ladi.
 * - Har xodim faqat o'z roli va bo'lim huquqlari bo'yicha ko'radi (saytdagi bilan bir xil: access.ts, scope.ts).
 *   Bir nechta tashkilotda bo'lsa, ma'lumotlar jamlanmaydi — har tashkilot alohida bo'lim.
 * - Tugmalar: «Bugun», «Faol reyslar», «Ogohlantirishlar», «Qidiruv» (yoki shunchaki matn yozish).
 * - Har kuni 9:00 (Toshkent): muddati tugayotgan hujjatlar, rad etilgan TIR/dazvol, obuna eslatmasi.
 * - Kirim (mijoz to'lovi, ijarachidan to'lov, boshqa kirim) — rahbar va buxgalterga xabar.
 *
 * "server-only" import qilinmaydi: bot instrumentation.ts dan ishga tushadi.
 */
import type { PaymentMethod, Role } from "@prisma/client";
import { uz } from "@/i18n/uz";
import { db } from "./db";
import { can } from "./roles";
import { canView, parseAccess, roleTitle, type Access } from "./access";
import { orgScope } from "./scope";
import { formatDate } from "./dates";
import { formatNumber } from "./currency-core";
import { accountLabel } from "./cash-core";
import { EVENT_ORDER, tripNumber } from "./trips-core";
import { daysLeft, tashkentToday } from "./docs";
import { groupAlerts, loadAlerts, type AlertItem } from "./alerts";
import { balances, cashEnabled, loadAccounts, loadMovements, trackedOnly } from "./cash";
import { globalSearch } from "./search";
import { todaySummary, type Money } from "./today";
import { EV_DONE_UZ, appLink, botToken, esc, fmtTime, tg } from "./telegram-common";

export const BTN_TODAY = "📊 Bugun";
export const BTN_TRIPS = "🚚 Faol reyslar";
export const BTN_ALERTS = "⚠️ Ogohlantirishlar";
export const BTN_SEARCH = "🔎 Qidiruv";
export const STAFF_ROWS = [[BTN_TODAY, BTN_TRIPS], [BTN_ALERTS, BTN_SEARCH]];

/** Xodimning bitta tashkilotdagi a'zoligi (sessiyadagi CurrentUser'ga o'xshash: rol, huquqlar, tashkilot). */
export type StaffMember = {
  id: string; // User.id
  accountId: string;
  orgId: string;
  orgName: string;
  role: Role;
  access: Access;
  fullName: string;
  roleTitle: string;
};

const tr = (key: keyof typeof uz) => uz[key];

const MEMBER_WHERE = {
  status: "ACTIVE" as const,
  isDemo: false,
  orgId: { not: null },
  role: { not: "SUPER_ADMIN" as const },
  org: { status: "ACTIVE" as const, isDemo: false },
};

/**
 * Shu chatga ulangan xodim a'zoliklari. Ulanishdagi telefon endi hisobda ham, faol a'zolikda ham bo'lmasa —
 * bog'lanish bekor qilinadi (raqam o'zgargan yoki xodim bloklangan).
 */
export async function staffMembers(chatId: string): Promise<StaffMember[]> {
  const accounts = await db.account.findMany({
    where: { telegramChatId: chatId, isDemo: false },
    select: {
      id: true, phone: true, telegramPhone: true,
      users: { where: MEMBER_WHERE, select: { id: true, role: true, access: true, fullName: true, specialistNo: true, phone: true, orgId: true, org: { select: { name: true } } } },
    },
  });
  const out: StaffMember[] = [];
  for (const a of accounts) {
    const p = a.telegramPhone;
    if (!p || (a.phone !== p && !a.users.some((u) => u.phone === p))) {
      await db.account.update({ where: { id: a.id }, data: { telegramChatId: null, telegramPhone: null, telegramLinkedAt: null } });
      continue;
    }
    for (const u of a.users) {
      out.push({
        id: u.id, accountId: a.id, orgId: u.orgId!, orgName: u.org!.name, role: u.role, access: parseAccess(u.access), fullName: u.fullName,
        roleTitle: roleTitle((k) => uz[k], u),
      });
    }
  }
  return out;
}

/** Telefon bo'yicha xodim hisob(lar)ini shu chatga bog'laydi; boshqa hisoblardan shu chat olib tashlanadi. */
export async function linkStaff(chatId: string, phone: string): Promise<StaffMember[]> {
  const accounts = await db.account.findMany({
    where: { isDemo: false, OR: [{ phone }, { users: { some: { ...MEMBER_WHERE, phone } } }] },
    select: { id: true },
  });
  const ids = accounts.map((a) => a.id);
  await db.$transaction([
    db.account.updateMany({ where: { telegramChatId: chatId, id: { notIn: ids } }, data: { telegramChatId: null, telegramPhone: null, telegramLinkedAt: null } }),
    db.account.updateMany({ where: { id: { in: ids } }, data: { telegramChatId: chatId, telegramPhone: phone, telegramLinkedAt: new Date() } }),
  ]);
  return staffMembers(chatId);
}

/** "Mening hisobim" sahifasidan botni uzish. */
export async function unlinkStaff(accountId: string): Promise<void> {
  await db.account.update({ where: { id: accountId }, data: { telegramChatId: null, telegramPhone: null, telegramLinkedAt: null } });
}

// ---------- Matn yig'ish ----------

function money(m: Money | null): string {
  const e = Object.entries(m ?? {}).filter(([, v]) => Math.abs(v) > 0.004);
  return e.length ? e.map(([cur, v]) => `${formatNumber(v)} ${cur}`).join(", ") : "yo'q";
}

/** Bir nechta tashkilot bo'lsa, har biri sarlavha bilan. */
function blocks(members: StaffMember[], parts: string[][]): string {
  return members
    .map((m, i) => (members.length > 1 ? [`🏢 <b>${esc(m.orgName)}</b>`, ...parts[i]] : parts[i]).join("\n"))
    .join("\n\n");
}

/** Qatorlarni Telegram chegarasiga (4096) sig'diradi — HTML teglar o'rtasidan kesilmaydi. */
function fit(lines: string[], max = 3800): string {
  const out: string[] = [];
  let len = 0;
  for (const l of lines) {
    if (len + l.length + 1 > max) { out.push("…"); break; }
    out.push(l);
    len += l.length + 1;
  }
  return out.join("\n");
}

async function send(chatId: number | string, text: string, markup?: unknown) {
  await tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, ...(markup ? { reply_markup: markup } : {}) });
}

async function todayLines(m: StaffMember): Promise<string[]> {
  const s = await todaySummary(m);
  const lines: string[] = [];
  if (s.activeTrips !== null) lines.push(`🚚 ${tr("home.activeTrips")}: <b>${s.activeTrips}</b> (${tr("trip.withCargo").toLowerCase()}: ${s.loadedTrips}, qaytmoqda: ${s.activeTrips - s.loadedTrips})`);
  if (s.clientDebt) lines.push(`👥 ${tr("home.clientDebt")}: <b>${money(s.clientDebt)}</b>`);
  if (s.lessorDebt) lines.push(`🚛 ${tr("home.lessorDebt")}: <b>${money(s.lessorDebt)}</b>`);
  if (s.staffDebt) lines.push(`👷 ${tr("home.staffDebt")}: <b>${money(s.staffDebt)}</b>`);
  if (canView(m, "cash") && (await cashEnabled(m.orgId))) {
    const all = await loadAccounts(m.orgId);
    const { accounts, movements } = trackedOnly(all, await loadMovements(m.orgId));
    const b = balances(accounts, movements);
    const byCur: Money = {};
    for (const a of accounts) byCur[a.currency] = Math.round(((byCur[a.currency] ?? 0) + (b.get(a.id) ?? 0)) * 100) / 100;
    lines.push(`🏦 Kassa qoldig'i: <b>${accounts.length ? Object.entries(byCur).map(([c, v]) => `${formatNumber(v)} ${c}`).join(", ") : "hisob ochilmagan"}</b>`);
  }
  return lines.length ? lines : ["Bu ma'lumotlar sizga ochiq emas."];
}

async function tripLines(m: StaffMember): Promise<string[]> {
  if (!canView(m, "trips")) return ["Tashishlar bo'limi sizga ochiq emas."];
  const where = { ...orgScope(m), status: "ACTIVE" as const };
  const [trips, total] = await Promise.all([
    db.trip.findMany({
      where, orderBy: { loadDate: "asc" }, take: 20,
      select: { id: true, number: true, routeFrom: true, routeTo: true, tractor: { select: { plate: true } }, driver: { select: { fullName: true } }, events: { select: { type: true, at: true } } },
    }),
    db.trip.count({ where }),
  ]);
  if (!trips.length) return ["Faol reys yo'q."];
  const lines = [`🚚 Faol reyslar: <b>${total}</b>`];
  for (const t of trips) {
    const done = new Map(t.events.map((e) => [e.type as string, e.at]));
    const last = [...EVENT_ORDER].reverse().find((s) => done.has(s));
    const stage = last ? `✅ ${EV_DONE_UZ[last]} — ${fmtTime(done.get(last)!)}` : "⏳ haydovchi hali qabul qilmagan";
    lines.push("", `${appLink(`/trips/${t.id}`, tripNumber(t.number))} · ${esc(t.routeFrom)} → ${esc(t.routeTo)}`, `   ${esc(t.tractor.plate)} · ${esc(t.driver.fullName)} · ${stage}`);
  }
  if (total > trips.length) lines.push("", `… va yana ${total - trips.length} ta — saytda ko'ring.`);
  return lines;
}

function alertLine(x: AlertItem, today: Date): string {
  const label = x.title || (x.docType ? tr(`doc.t.${x.docType}`) : tr("alerts.lease"));
  const n = daysLeft(x.expiresAt, today) ?? 0;
  const when = n < 0 ? `${-n} kun o'tdi` : n === 0 ? "bugun" : `${n} kun`;
  return `• ${appLink(x.href, x.owner)} — ${esc(label)}${x.number ? ` № ${esc(x.number)}` : ""} — ${formatDate(x.expiresAt)} (${when})`;
}

/** Haydovchi bot orqali rad etgan TIR/dazvol (oxirgi harakat) — TIR sahifasi tepasidagi ro'yxat bilan bir xil. */
async function rejectedPermits(m: StaffMember): Promise<string[]> {
  const types = [...(canView(m, "tir") ? ["TIR" as const] : []), ...(canView(m, "dazvol") ? ["DAZVOL" as const] : [])];
  if (!types.length) return [];
  const list = await db.permit.findMany({
    where: { ...orgScope(m), type: { in: types }, status: { in: ["STOCK", "ISSUED", "USED", "RETURNED"] }, moves: { some: { ack: "REJECTED" } } },
    select: { id: true, number: true, type: true, moves: { orderBy: { createdAt: "desc" }, take: 1, select: { ack: true, driverName: true } } },
  });
  return list
    .filter((p) => p.moves[0]?.ack === "REJECTED")
    .map((p) => `• ${appLink(`${p.type === "TIR" ? "/tir" : "/dazvol"}/${p.id}`, `${tr(`tir.t.${p.type}`)} № ${p.number}`)}${p.moves[0].driverName ? ` — ${esc(p.moves[0].driverName)}` : ""}`);
}

/** Obuna eslatmasi (saytdagi banner bilan bir xil qoida) — rahbar va buxgalterga. */
async function billingNote(m: StaffMember, today: Date): Promise<string | null> {
  if (!can(m.role, "billing.manage")) return null;
  const [org, unpaid] = await Promise.all([
    db.organization.findUnique({ where: { id: m.orgId }, select: { subEnd: true } }),
    db.invoice.count({ where: { orgId: m.orgId, status: "UNPAID" } }),
  ]);
  const day = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const left = org?.subEnd ? Math.floor((org.subEnd.getTime() - day) / 86_400_000) : null;
  if (left !== null && left < 0) return tr("sub.bannerExpired");
  if (unpaid > 0) return tr("sub.bannerUnpaid");
  if (left !== null && left <= 7) return tr("sub.bannerSoon").replace("{n}", String(left));
  return null;
}

/**
 * Ogohlantirishlar. `digest` — ertalabki xabar uchun qisqa: muddati o'tgan va 7 kun ichidagilar ro'yxati, 15/30 kunlik — soni.
 * Ogohlantirishlar sahifasi saytda ham faqat data.view rollariga ochiq (mutaxassisga yopiq) — botda ham shunday.
 */
async function alertLines(m: StaffMember, today: Date, digest: boolean): Promise<string[]> {
  const lines: string[] = [];
  if (can(m.role, "data.view")) {
    const g = groupAlerts(await loadAlerts(m, today), today);
    const sections: [string, AlertItem[], boolean][] = [
      [`⛔ ${tr("alerts.expired")}`, g.expired, true],
      [`🔴 ${tr("alerts.d7")}`, g.d7, true],
      [`🟠 ${tr("alerts.d15")}`, g.d15, !digest],
      [`🟡 ${tr("alerts.d30")}`, g.d30, !digest],
    ];
    for (const [title, items, list] of sections) {
      if (!items.length) continue;
      if (lines.length) lines.push("");
      lines.push(`${title}: <b>${items.length}</b>`);
      if (list) {
        for (const x of items.slice(0, 15)) lines.push(alertLine(x, today));
        if (items.length > 15) lines.push(`… va yana ${items.length - 15} ta`);
      }
    }
  }
  const rejected = await rejectedPermits(m);
  if (rejected.length) {
    if (lines.length) lines.push("");
    lines.push(`❗ Haydovchi rad etgan blankalar: <b>${rejected.length}</b>`, ...rejected.slice(0, 10));
  }
  const note = await billingNote(m, today);
  if (note) {
    if (lines.length) lines.push("");
    lines.push(`💳 ${esc(note)}`);
  }
  return lines;
}

// ---------- Tugmalar va qidiruv ----------

/**
 * Xodim yozgan matn. true — qayta ishlandi. Tugma yoki buyruq bo'lmasa (va "/" bilan boshlanmasa) — qidiruv.
 */
export async function staffText(chatId: number, text: string, members: StaffMember[], markup: unknown): Promise<boolean> {
  const today = tashkentToday();
  if (text === BTN_TODAY || text === "/bugun") {
    const parts = await Promise.all(members.map(todayLines));
    await send(chatId, fit([`📊 <b>Bugungi holat</b> — ${formatDate(today)}`, "", ...blocks(members, parts).split("\n")]), markup);
    return true;
  }
  if (text === BTN_TRIPS || text === "/reyslar") {
    const parts = await Promise.all(members.map(tripLines));
    await send(chatId, fit(blocks(members, parts).split("\n")), markup);
    return true;
  }
  if (text === BTN_ALERTS || text === "/ogohlantirish") {
    const parts = await Promise.all(members.map(async (m) => {
      const l = await alertLines(m, today, false);
      return l.length ? l : [can(m.role, "data.view") ? "✅ Muddati yaqin hujjat yo'q." : "Ogohlantirishlar sizga ochiq emas."];
    }));
    await send(chatId, fit([`⚠️ <b>${tr("alerts.title")}</b>`, "", ...blocks(members, parts).split("\n")]), markup);
    return true;
  }
  if (text === BTN_SEARCH || text === "/qidiruv") {
    await send(chatId, "🔎 Qidirish uchun yozing: reys raqami (masalan 42), davlat raqami, mijoz yoki haydovchi ismi, TIR/dazvol raqami. Kamida 2 belgi.", markup);
    return true;
  }
  if (text.startsWith("/")) return false;
  const q = text.slice(0, 80);
  if (q.length < 2) {
    await send(chatId, tr("search.min"), markup);
    return true;
  }
  const parts = await Promise.all(members.map(async (m) => {
    const groups = (await globalSearch(m, q, tr, { trips: 5, other: 5 })).filter((g) => g.hits.length);
    if (!groups.length) return [tr("search.none")];
    const lines: string[] = [];
    for (const g of groups) {
      if (lines.length) lines.push("");
      lines.push(`<b>${esc(g.title)}</b>`);
      for (const h of g.hits) lines.push(`• ${appLink(h.href, h.title)}${h.sub ? `\n   ${esc(h.sub)}` : ""}`);
    }
    return lines;
  }));
  await send(chatId, fit([`🔎 «${esc(q)}»`, "", ...blocks(members, parts).split("\n")]), markup);
  return true;
}

// ---------- Ertalabki ogohlantirish (har kuni 9:00, Toshkent) ----------

/** Barcha ulangan xodimlarga kunlik xabar; yuborilgan xabarlar soni. Aytadigan gap bo'lmasa — yuborilmaydi. */
export async function sendDailyDigest(now: Date = new Date(), onlyChats?: string[]): Promise<number> {
  if (!botToken()) return 0;
  const today = tashkentToday(now);
  const chats = await db.account.findMany({
    where: { telegramChatId: onlyChats ? { in: onlyChats } : { not: null }, isDemo: false },
    select: { telegramChatId: true },
    distinct: ["telegramChatId"],
  });
  let sent = 0;
  for (const { telegramChatId } of chats) {
    const chat = telegramChatId!;
    try {
      const members = await staffMembers(chat);
      const withNews: StaffMember[] = [];
      const parts: string[][] = [];
      for (const m of members) {
        const l = await alertLines(m, today, true);
        if (l.length) { withNews.push(m); parts.push(l); }
      }
      if (!withNews.length) continue;
      await send(chat, fit([`🌅 <b>Kunlik ogohlantirish</b> — ${formatDate(today)}`, "", ...blocks(withNews, parts).split("\n"), "", `To'liq ro'yxat: «${BTN_ALERTS}»`]));
      sent++;
    } catch (e) {
      console.error("[telegram] kunlik xabar yuborilmadi:", e instanceof Error ? e.message : e);
    }
  }
  return sent;
}

const DIGEST_HOUR = 9;
const g = globalThis as unknown as { reysproDigestTimer?: boolean };

/** Har 10 daqiqada tekshiradi: Toshkentda soat 9:00 dan o'tgan va bugun hali yuborilmagan bo'lsa — yuboradi. */
export function startStaffDigest() {
  if (g.reysproDigestTimer || !botToken()) return;
  g.reysproDigestTimer = true;
  const run = async () => {
    const t = tashkentToday();
    if (t.getUTCHours() < DIGEST_HOUR) return;
    const day = t.toISOString().slice(0, 10);
    const row = await db.appSetting.findUnique({ where: { key: "staffDigestDay" } });
    if (row?.value === day) return;
    // Avval belgilaymiz: server qayta ishga tushsa ham bir kunda ikki marta yuborilmasin.
    await db.appSetting.upsert({ where: { key: "staffDigestDay" }, create: { key: "staffDigestDay", value: day }, update: { value: day } });
    const n = await sendDailyDigest();
    console.log(`[telegram] kunlik ogohlantirish: ${n} ta xodimga yuborildi`);
  };
  const safe = () => run().catch((e) => console.error("[telegram] kunlik ogohlantirish xatosi:", e instanceof Error ? e.message : e));
  setTimeout(safe, 60_000);
  setInterval(safe, 600_000);
}

// ---------- Kirim xabari (rahbar va buxgalterga) ----------

const METHOD_UZ: Record<PaymentMethod, string> = { BANK: "Bank o'tkazmasi", CASH: "Naqd", CARD: "Karta" };

type IncomeInfo = { orgId: string; head: string; from: string; to: string; date: Date; note: string | null };

async function incomeInfo(kind: "payment" | "lessor" | "entry", id: string): Promise<IncomeInfo | null> {
  const accSel = { select: { kind: true, name: true, accountNumber: true, cardNumber: true, cardHolder: true, currency: true } };
  if (kind === "payment") {
    const p = await db.payment.findUnique({ where: { id }, include: { client: { select: { name: true } }, account: accSel } });
    if (!p || p.status !== "ACTIVE") return null;
    return {
      orgId: p.orgId, head: `${formatNumber(Number(p.amount))} ${p.currency}`, from: `Mijozdan: ${p.client.name}`,
      to: p.account ? accountLabel(p.account) : `${METHOD_UZ[p.method]}${p.receivedBy === "DRIVER" ? " (haydovchida)" : ""}`, date: p.date, note: p.note,
    };
  }
  if (kind === "lessor") {
    const e = await db.driverEntry.findUnique({ where: { id }, include: { driver: { select: { fullName: true } }, account: accSel } });
    if (!e || e.status !== "ACTIVE" || e.side !== "LESSOR" || e.kind !== "PAYMENT") return null;
    return {
      orgId: e.orgId, head: `${formatNumber(Number(e.amount))} ${e.currency}`, from: `Ijarachidan: ${e.driver.fullName}`,
      to: e.account ? accountLabel(e.account) : "—", date: e.date, note: e.note,
    };
  }
  const c = await db.cashEntry.findUnique({ where: { id }, include: { account: accSel } });
  if (!c || c.status !== "ACTIVE" || c.direction !== "IN") return null;
  return {
    orgId: c.orgId, head: `${formatNumber(Number(c.amount))} ${c.account.currency}`, from: `Boshqa kirim: ${c.party}`,
    to: accountLabel(c.account), date: c.date, note: c.note,
  };
}

/**
 * Kirim kiritilganda rahbar va buxgalterga xabar (botga ulangan bo'lsa). Kiritgan kishining o'ziga yuborilmaydi.
 * Xato asosiy amalni to'xtatmaydi.
 */
export async function notifyIncome(kind: "payment" | "lessor" | "entry", id: string, actorUserId: string): Promise<void> {
  try {
    if (!botToken()) return;
    const info = await incomeInfo(kind, id);
    if (!info) return;
    const [actor, org] = await Promise.all([
      db.user.findUnique({ where: { id: actorUserId }, select: { accountId: true, fullName: true } }),
      db.organization.findUnique({ where: { id: info.orgId }, select: { name: true } }),
    ]);
    const candidates = await db.user.findMany({
      where: { ...MEMBER_WHERE, orgId: info.orgId, role: { in: ["DIRECTOR", "ACCOUNTANT"] }, account: { telegramChatId: { not: null }, isDemo: false } },
      select: { account: { select: { telegramChatId: true } } },
    });
    const chats = [...new Set(candidates.map((c) => c.account.telegramChatId!))];
    const text = [
      `💵 <b>Kirim: ${esc(info.head)}</b>`,
      esc(info.from),
      `Qayerga: ${esc(info.to)}`,
      `Sana: ${formatDate(info.date)}`,
      ...(info.note ? [`Izoh: ${esc(info.note)}`] : []),
      ...(actor ? [`Kiritdi: ${esc(actor.fullName)}`] : []),
      `🏢 ${esc(org?.name ?? "")}`,
    ].join("\n");
    for (const chat of chats) {
      // Har chat uchun huquq qayta tekshiriladi (telefon o'zgargan, bloklangan bo'lsa yuborilmaydi).
      const members = await staffMembers(chat);
      const ok = members.some((m) => m.orgId === info.orgId && (m.role === "DIRECTOR" || m.role === "ACCOUNTANT") && m.accountId !== actor?.accountId);
      if (ok) await send(chat, text).catch((e) => console.error("[telegram] kirim xabari yuborilmadi:", e instanceof Error ? e.message : e));
    }
  } catch (e) {
    console.error("[telegram] kirim xabari xatosi:", e instanceof Error ? e.message : e);
  }
}
