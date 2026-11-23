// Haydovchi joylashuvi (23.11.2026): sof qoidalar + bot orqali (haqiqiy baza, soxta Telegram serveri).
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { handleUpdate } from "@/lib/telegram-bot";
import { distanceKm, liveUntilFrom, locState, needsReminder, shouldStore, LIVE_FOREVER } from "@/lib/location-core";
import { pruneLocations, sendLocationReminders } from "@/lib/telegram-location";

describe("location-core", () => {
  const now = new Date("2026-11-23T08:00:00Z"); // Toshkent 13:00
  it("measures distance", () => {
    expect(distanceKm({ lat: 41.3111, lng: 69.2797 }, { lat: 39.6542, lng: 66.9597 })).toBeGreaterThan(260);
    expect(distanceKm({ lat: 41.3111, lng: 69.2797 }, { lat: 39.6542, lng: 66.9597 })).toBeLessThan(275);
  });
  it("stores a point every 5 minutes or 1 km", () => {
    const prev = { lat: 41.3, lng: 69.2, at: new Date(now.getTime() - 60_000) };
    expect(shouldStore(null, { lat: 41.3, lng: 69.2 }, now)).toBe(true);
    expect(shouldStore(prev, { lat: 41.3001, lng: 69.2 }, now)).toBe(false);
    expect(shouldStore(prev, { lat: 41.32, lng: 69.2 }, now)).toBe(true);
    expect(shouldStore({ ...prev, at: new Date(now.getTime() - 5 * 60_000) }, { lat: 41.3, lng: 69.2 }, now)).toBe(true);
  });
  it("handles 'until I turn it off' (about 68 years) and caps at 2100", () => {
    expect(liveUntilFrom(1_700_000_000, 3600).getTime()).toBe(1_700_003_600_000);
    expect(liveUntilFrom(1_800_000_000, LIVE_FOREVER).getUTCFullYear()).toBeGreaterThan(2090);
    expect(liveUntilFrom(3_000_000_000, LIVE_FOREVER).getUTCFullYear()).toBe(2100);
  });
  it("derives map state", () => {
    const future = new Date(now.getTime() + 3600_000);
    expect(locState({ lastLocAt: null, liveUntil: null }, now)).toBe("NONE");
    expect(locState({ lastLocAt: now, liveUntil: future }, now)).toBe("LIVE");
    expect(locState({ lastLocAt: new Date(now.getTime() - 7 * 3600_000), liveUntil: future }, now)).toBe("STALE");
    expect(locState({ lastLocAt: now, liveUntil: new Date(now.getTime() - 1) }, now)).toBe("STOPPED");
  });
  it("reminds only tracked drivers on a trip, by day, every 3 hours", () => {
    const base = { trackLocation: true, telegramChatId: "1", lastLocAt: null, liveUntil: null, locRemindedAt: null, hasActiveTrip: true };
    expect(needsReminder(base, now)).toBe(true);
    expect(needsReminder({ ...base, trackLocation: false }, now)).toBe(false);
    expect(needsReminder({ ...base, hasActiveTrip: false }, now)).toBe(false);
    expect(needsReminder({ ...base, telegramChatId: null }, now)).toBe(false);
    expect(needsReminder({ ...base, locRemindedAt: new Date(now.getTime() - 3600_000) }, now)).toBe(false);
    expect(needsReminder(base, new Date("2026-11-23T18:00:00Z"))).toBe(false); // Toshkent 23:00
    expect(needsReminder({ ...base, lastLocAt: now, liveUntil: new Date(now.getTime() + 3600_000) }, now)).toBe(false);
  });
});

type Sent = { method: string; body: { chat_id?: number | string; text?: string; reply_markup?: { keyboard?: { text: string }[][] } } };
let sent: Sent[] = [];
let server: Server;
const PHONE = { a: "+998999960001", b: "+998999960002" };
const CHAT = { a: 96001, b: 96002 };
const ids = { orgA: "", orgB: "", drvA: "", drvB: "", drvA2: "", user: "", account: "" };
let updateId = 1;
const msg = (chat: number, extra: object) =>
  handleUpdate({ update_id: updateId++, message: { message_id: 5, date: Math.floor(Date.now() / 1000), chat: { id: chat, type: "private" }, from: { id: chat + 1 }, ...extra } } as never);
const edit = (chat: number, location: object) =>
  handleUpdate({ update_id: updateId++, edited_message: { message_id: 5, date: Math.floor(Date.now() / 1000) - 60, chat: { id: chat, type: "private" }, location } } as never);
const to = (chat: number) => sent.filter((s) => s.method === "sendMessage" && String(s.body.chat_id) === String(chat));

async function cleanup() {
  const orgIds = (await db.organization.findMany({ where: { name: { startsWith: "Loc test" } }, select: { id: true } })).map((o) => o.id);
  await db.driverLocation.deleteMany({ where: { orgId: { in: orgIds } } });
  await db.trip.deleteMany({ where: { orgId: { in: orgIds } } });
  await db.driver.deleteMany({ where: { orgId: { in: orgIds } } });
  await db.vehicle.deleteMany({ where: { orgId: { in: orgIds } } });
  const accs = await db.account.findMany({ where: { email: { endsWith: "@loc-test.uz" } }, select: { id: true } });
  await db.user.deleteMany({ where: { accountId: { in: accs.map((a) => a.id) } } });
  await db.account.deleteMany({ where: { id: { in: accs.map((a) => a.id) } } });
  await db.organization.deleteMany({ where: { id: { in: orgIds } } });
}

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      sent.push({ method: (req.url ?? "").split("/").pop() ?? "", body: raw ? JSON.parse(raw) : {} });
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, result: { message_id: 1 } }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  process.env.TELEGRAM_API_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  await cleanup();
  ids.orgA = (await db.organization.create({ data: { name: "Loc test A" } })).id;
  ids.orgB = (await db.organization.create({ data: { name: "Loc test B" } })).id;
  const acc = await db.account.create({ data: { email: "dir@loc-test.uz" } });
  ids.account = acc.id;
  ids.user = (await db.user.create({ data: { accountId: acc.id, orgId: ids.orgA, role: "DIRECTOR", phone: "+998999960009", fullName: "Dir" } })).id;
  // Driver A — kuzatuv yoqilgan, faol reysda; o'sha odam B tashkilotida ham haydovchi, lekin u yerda kuzatuv o'chiq.
  ids.drvA = (await db.driver.create({ data: { orgId: ids.orgA, fullName: "Kuzatiladigan", category: "EMPLOYEE", phone: PHONE.a, trackLocation: true } })).id;
  ids.drvA2 = (await db.driver.create({ data: { orgId: ids.orgB, fullName: "Kuzatiladigan (B)", category: "EMPLOYEE", phone: PHONE.a } })).id;
  ids.drvB = (await db.driver.create({ data: { orgId: ids.orgA, fullName: "Oddiy", category: "EMPLOYEE", phone: PHONE.b } })).id;
  const veh = await db.vehicle.create({ data: { orgId: ids.orgA, plate: "01L111OC", type: "TRACTOR" } });
  await db.trip.create({ data: { orgId: ids.orgA, number: 1, routeFrom: "Toshkent (Uzbekistan)", routeTo: "Moskva (Russia)", tractorId: veh.id, driverId: ids.drvA, loadDate: new Date(Date.UTC(2026, 10, 20)), createdById: ids.user } });
});

afterAll(async () => {
  await cleanup();
  await new Promise((r) => server.close(r));
  await db.$disconnect();
});

beforeEach(() => { sent = []; });

describe("bot location", () => {
  it("shows the location button only to tracked drivers", async () => {
    await msg(CHAT.a, { contact: { phone_number: PHONE.a, user_id: CHAT.a + 1 } });
    const kb = to(CHAT.a)[0].body.reply_markup?.keyboard?.flat().map((b) => b.text) ?? [];
    expect(kb).toContain("📍 Joylashuv");
    expect(to(CHAT.a).at(-1)!.body.text).toContain("Men o'chirgunimcha");
    await msg(CHAT.b, { contact: { phone_number: PHONE.b, user_id: CHAT.b + 1 } });
    expect(to(CHAT.b)[0].body.reply_markup?.keyboard?.flat().map((b) => b.text)).not.toContain("📍 Joylashuv");
  });

  it("stores live location only for the org where tracking is on", async () => {
    await msg(CHAT.a, { location: { latitude: 41.3, longitude: 69.2, live_period: LIVE_FOREVER } });
    expect(to(CHAT.a).at(-1)!.body.text).toContain("Jonli joylashuv qabul qilindi");
    const a = await db.driver.findUniqueOrThrow({ where: { id: ids.drvA } });
    expect(a.lastLat).toBe(41.3);
    expect(a.liveUntil!.getUTCFullYear()).toBeGreaterThan(2090);
    const a2 = await db.driver.findUniqueOrThrow({ where: { id: ids.drvA2 } });
    expect(a2.lastLat).toBeNull();
    expect(await db.driverLocation.count({ where: { driverId: ids.drvA } })).toBe(1);
    expect(await db.driverLocation.count({ where: { orgId: ids.orgB } })).toBe(0);
  });

  it("updates on edits, throttles history, and detects stop", async () => {
    await edit(CHAT.a, { latitude: 41.3002, longitude: 69.2, live_period: LIVE_FOREVER });
    expect(await db.driverLocation.count({ where: { driverId: ids.drvA } })).toBe(1); // 20 m — tarixga yozilmaydi
    expect((await db.driver.findUniqueOrThrow({ where: { id: ids.drvA } })).lastLat).toBe(41.3002);
    await edit(CHAT.a, { latitude: 41.35, longitude: 69.2, live_period: LIVE_FOREVER });
    expect(await db.driverLocation.count({ where: { driverId: ids.drvA } })).toBe(2); // 5 km
    expect(to(CHAT.a)).toHaveLength(0); // tahrirlarga javob yo'q
    await edit(CHAT.a, { latitude: 41.35, longitude: 69.2 });
    const a = await db.driver.findUniqueOrThrow({ where: { id: ids.drvA } });
    expect(a.liveUntil!.getTime()).toBeLessThanOrEqual(Date.now());
    expect(to(CHAT.a).at(-1)!.body.text).toContain("to'xtatildi");
  });

  it("does not store an untracked driver's location", async () => {
    await msg(CHAT.b, { location: { latitude: 40, longitude: 70 } });
    expect(to(CHAT.b).at(-1)!.body.text).toContain("kuzatuvi yoqilmagan");
    expect((await db.driver.findUniqueOrThrow({ where: { id: ids.drvB } })).lastLat).toBeNull();
    expect(await db.driverLocation.count({ where: { driverId: ids.drvB } })).toBe(0);
  });

  it("ignores locations from groups", async () => {
    await handleUpdate({ update_id: updateId++, message: { message_id: 1, chat: { id: -96009, type: "group" }, from: { id: CHAT.a + 1 }, location: { latitude: 1, longitude: 1 } } } as never);
    expect(sent).toHaveLength(0);
  });

  it("reminds once when sharing stopped during a trip", async () => {
    const day = new Date("2026-11-23T08:00:00Z"); // Toshkent 13:00
    await db.driver.update({ where: { id: ids.drvA }, data: { liveUntil: new Date("2026-11-23T07:00:00Z") } });
    expect(await sendLocationReminders(day)).toBe(1);
    expect(to(CHAT.a).at(-1)!.body.text).toContain("o'chiq");
    expect(to(CHAT.b)).toHaveLength(0);
    expect(await sendLocationReminders(new Date(day.getTime() + 3600_000))).toBe(0);
  });

  it("prunes history older than 180 days", async () => {
    await db.driverLocation.create({ data: { orgId: ids.orgA, driverId: ids.drvA, lat: 1, lng: 1, at: new Date(Date.now() - 200 * 86_400_000) } });
    expect(await pruneLocations()).toBeGreaterThanOrEqual(1);
    expect(await db.driverLocation.count({ where: { driverId: ids.drvA } })).toBe(2);
  });
});
