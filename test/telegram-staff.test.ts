// Telegram bot — tashkilot xodimlari (19.11.2026). Haqiqiy bazada ishlaydi (DATABASE_URL); Telegram o'rniga soxta server.
// Test o'z tashkilotlari, hisoblari va yozuvlarini yaratib, oxirida o'chiradi.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { handleUpdate } from "@/lib/telegram-bot";
import { notifyIncome, sendDailyDigest, staffMembers, unlinkStaff } from "@/lib/telegram-staff";

type Sent = { method: string; body: { chat_id?: number | string; text?: string; reply_markup?: { keyboard?: { text: string }[][] } } };
let sent: Sent[] = [];
let server: Server;

const P = { dir: "+998999970001", spec: "+998999970002", mgrB: "+998999970003", acc: "+998999970004" };
const CHAT = { dir: 97001, spec: 97002, mgrB: 97003, acc: 97004, group: -97009 };
const ids: { orgA: string; orgB: string; accounts: string[]; users: Record<string, string>; tripA: string; tripB: string; vehA: string; clientA: string } = {
  orgA: "", orgB: "", accounts: [], users: {}, tripA: "", tripB: "", vehA: "", clientA: "",
};

let updateId = 1;
const contact = (chat: number, phone: string, type = "private") =>
  handleUpdate({ update_id: updateId++, message: { message_id: 1, chat: { id: chat, type }, from: { id: chat + 1 }, contact: { phone_number: phone, user_id: chat + 1 } } } as never);
const say = (chat: number, text: string) =>
  handleUpdate({ update_id: updateId++, message: { message_id: 1, chat: { id: chat, type: "private" }, from: { id: chat + 1 }, text } } as never);
const to = (chat: number | string) => sent.filter((s) => s.method === "sendMessage" && String(s.body.chat_id) === String(chat));
const lastText = (chat: number) => to(chat).at(-1)?.body.text ?? "";

async function cleanup() {
  const orgs = await db.organization.findMany({ where: { name: { startsWith: "TG staff test" } }, select: { id: true } });
  const orgIds = orgs.map((o) => o.id);
  await db.payment.deleteMany({ where: { orgId: { in: orgIds } } });
  await db.shipment.deleteMany({ where: { orgId: { in: orgIds } } });
  await db.tripEvent.deleteMany({ where: { trip: { orgId: { in: orgIds } } } });
  await db.trip.deleteMany({ where: { orgId: { in: orgIds } } });
  await db.document.deleteMany({ where: { orgId: { in: orgIds } } });
  await db.driver.deleteMany({ where: { orgId: { in: orgIds } } });
  await db.vehicle.deleteMany({ where: { orgId: { in: orgIds } } });
  await db.client.deleteMany({ where: { orgId: { in: orgIds } } });
  const accs = await db.account.findMany({ where: { OR: [{ phone: { in: Object.values(P) } }, { email: { endsWith: "@tg-staff-test.uz" } }] }, select: { id: true } });
  await db.user.deleteMany({ where: { OR: [{ orgId: { in: orgIds } }, { accountId: { in: accs.map((a) => a.id) } }] } });
  await db.account.deleteMany({ where: { id: { in: accs.map((a) => a.id) } } });
  await db.organization.deleteMany({ where: { id: { in: orgIds } } });
}

async function member(key: string, orgId: string, role: "DIRECTOR" | "ACCOUNTANT" | "MANAGER" | "SPECIALIST", phone: string, accountPhone: string | null, access?: object) {
  const acc = await db.account.create({ data: { email: `${key}@tg-staff-test.uz`, phone: accountPhone } });
  ids.accounts.push(acc.id);
  const u = await db.user.create({ data: { accountId: acc.id, orgId, role, phone, fullName: `Test ${key}`, specialistNo: role === "SPECIALIST" ? 1 : null, access: access ?? undefined } });
  ids.users[key] = u.id;
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
  process.env.APP_URL = "https://crm.test";

  await cleanup();
  ids.orgA = (await db.organization.create({ data: { name: "TG staff test A" } })).id;
  ids.orgB = (await db.organization.create({ data: { name: "TG staff test B" } })).id;
  await member("dir", ids.orgA, "DIRECTOR", P.dir, P.dir);
  await member("spec", ids.orgA, "SPECIALIST", P.spec, P.spec, { trips: "VIEW" });
  // Buxgalter: hisobda telefon yo'q, faqat a'zolikda (rahbar kiritgan) — shu bo'yicha ham ulanadi.
  await member("acc", ids.orgA, "ACCOUNTANT", P.acc, null);
  await member("mgrB", ids.orgB, "MANAGER", P.mgrB, P.mgrB);

  const vehA = await db.vehicle.create({ data: { orgId: ids.orgA, plate: "01T777TG", type: "TRACTOR" } });
  const vehB = await db.vehicle.create({ data: { orgId: ids.orgB, plate: "30T888TG", type: "TRACTOR" } });
  ids.vehA = vehA.id;
  // Haydovchi telefoni mutaxassisniki bilan bir xil: bir kishi ham haydovchi, ham xodim.
  const drvA = await db.driver.create({ data: { orgId: ids.orgA, fullName: "Haydovchi A", category: "EMPLOYEE", phone: P.spec } });
  const drvB = await db.driver.create({ data: { orgId: ids.orgB, fullName: "Haydovchi B", category: "EMPLOYEE" } });
  const day = new Date(Date.UTC(2026, 10, 1));
  ids.tripA = (await db.trip.create({ data: { orgId: ids.orgA, number: 1, routeFrom: "Toshkent (Uzbekistan)", routeTo: "Varshava (Poland)", tractorId: vehA.id, driverId: drvA.id, loadDate: day, createdById: ids.users.dir } })).id;
  ids.tripB = (await db.trip.create({ data: { orgId: ids.orgB, number: 1, routeFrom: "Samarqand (Uzbekistan)", routeTo: "Almati (Kazakhstan)", tractorId: vehB.id, driverId: drvB.id, loadDate: day, createdById: ids.users.mgrB } })).id;
  ids.clientA = (await db.client.create({ data: { orgId: ids.orgA, name: "Artel TG test" } })).id;
  await db.shipment.create({ data: { orgId: ids.orgA, tripId: ids.tripA, clientId: ids.clientA, contactName: "K", contactPhone: "+998900000000", terms: "CONTRACT", price: 1000, currency: "USD", createdById: ids.users.dir } });
  // 3 kundan keyin tugaydigan sug'urta — kunlik ogohlantirish uchun.
  const soon = new Date(Date.now() + 3 * 86_400_000);
  await db.document.create({ data: { orgId: ids.orgA, type: "INSURANCE", number: "SUG-1", vehicleId: vehA.id, expiresAt: new Date(Date.UTC(soon.getUTCFullYear(), soon.getUTCMonth(), soon.getUTCDate())), createdById: ids.users.dir } });
});

afterAll(async () => {
  await cleanup();
  await new Promise((r) => server.close(r));
  await db.$disconnect();
});

beforeEach(() => {
  sent = [];
});

describe("linking", () => {
  it("links a director by the account phone and shows staff buttons", async () => {
    await contact(CHAT.dir, P.dir);
    const msg = to(CHAT.dir).at(-1)!;
    expect(msg.body.text).toContain("Rahbar: Test dir (TG staff test A)");
    expect(msg.body.reply_markup?.keyboard?.flat().map((b) => b.text)).toEqual(["📊 Bugun", "🚚 Faol reyslar", "⚠️ Ogohlantirishlar", "🔎 Qidiruv"]);
    expect((await staffMembers(String(CHAT.dir))).map((m) => m.role)).toEqual(["DIRECTOR"]);
  });
  it("links by the membership phone when the account has no phone", async () => {
    await contact(CHAT.acc, P.acc);
    expect(lastText(CHAT.acc)).toContain("Buxgalter: Test acc");
  });
  it("person who is both driver and staff gets both keyboards", async () => {
    await contact(CHAT.spec, P.spec);
    const msg = to(CHAT.spec).at(-1)!;
    expect(msg.body.text).toContain("Haydovchi: Haydovchi A");
    expect(msg.body.text).toContain("Mutaxassis-1: Test spec");
    expect(msg.body.reply_markup?.keyboard?.length).toBe(3);
  });
  it("refuses linking from a group chat", async () => {
    await contact(CHAT.group, P.mgrB, "group");
    expect(to(CHAT.group).at(-1)?.body.text).toContain("faqat shaxsiy chatda");
    expect(await staffMembers(String(CHAT.group))).toEqual([]);
    await contact(CHAT.mgrB, P.mgrB);
    expect(lastText(CHAT.mgrB)).toContain("Menejer: Test mgrB (TG staff test B)");
  });
});

describe("read-only views follow role and section rights", () => {
  it("director: today summary with trips and client debt", async () => {
    await say(CHAT.dir, "📊 Bugun");
    const text = lastText(CHAT.dir);
    expect(text).toContain("Faol reyslar: <b>1</b>");
    expect(text).toContain("Mijozlar qarzi");
  });
  it("specialist with only trips: no money, no alerts", async () => {
    await say(CHAT.spec, "📊 Bugun");
    expect(lastText(CHAT.spec)).toContain("Faol reyslar");
    expect(lastText(CHAT.spec)).not.toContain("Mijozlar qarzi");
    await say(CHAT.spec, "⚠️ Ogohlantirishlar");
    expect(lastText(CHAT.spec)).toContain("sizga ochiq emas");
  });
  it("active trips list links to the app", async () => {
    await say(CHAT.dir, "🚚 Faol reyslar");
    const text = lastText(CHAT.dir);
    expect(text).toContain(`https://crm.test/trips/${ids.tripA}`);
    expect(text).toContain("haydovchi hali qabul qilmagan");
  });
  it("search stays inside the organization and the allowed sections", async () => {
    await say(CHAT.dir, "Varshava");
    expect(lastText(CHAT.dir)).toContain(ids.tripA);
    await say(CHAT.dir, "Samarqand");
    expect(lastText(CHAT.dir)).toContain("Hech narsa topilmadi");
    expect(lastText(CHAT.dir)).not.toContain(ids.tripB);
    await say(CHAT.mgrB, "Varshava");
    expect(lastText(CHAT.mgrB)).toContain("Hech narsa topilmadi");
    // Mutaxassisda mijozlar bo'limi yo'q: reys (mijoz nomi bo'yicha) topiladi, mijoz kartochkasi — yo'q (saytdagi bilan bir xil).
    await say(CHAT.spec, "Artel");
    expect(lastText(CHAT.spec)).toContain(ids.tripA);
    expect(lastText(CHAT.spec)).not.toContain("<b>Mijozlar</b>");
    expect(lastText(CHAT.spec)).not.toContain("/clients/");
    await say(CHAT.dir, "Artel");
    expect(lastText(CHAT.dir)).toContain(`https://crm.test/clients/${ids.clientA}`);
  });
  it("director alerts list the expiring insurance", async () => {
    await say(CHAT.dir, "⚠️ Ogohlantirishlar");
    expect(lastText(CHAT.dir)).toContain("01T777TG");
    expect(lastText(CHAT.dir)).toContain("Sug'urta № SUG-1");
  });
});

describe("notifications", () => {
  it("income goes to director and accountant, not to the person who entered it", async () => {
    const p = await db.payment.create({ data: { orgId: ids.orgA, clientId: ids.clientA, date: new Date(Date.UTC(2026, 10, 19)), amount: 500, currency: "USD", method: "BANK", createdById: ids.users.acc } });
    await notifyIncome("payment", p.id, ids.users.acc);
    expect(lastText(CHAT.dir)).toContain("Kirim");
    expect(lastText(CHAT.dir)).toContain("Mijozdan: Artel TG test");
    expect(to(CHAT.acc)).toHaveLength(0);
    expect(to(CHAT.spec)).toHaveLength(0);
    expect(to(CHAT.mgrB)).toHaveLength(0);
  });
  it("daily digest reaches staff with alerts only", async () => {
    await sendDailyDigest(new Date(), [String(CHAT.dir), String(CHAT.spec), String(CHAT.mgrB)]);
    expect(lastText(CHAT.dir)).toContain("Kunlik ogohlantirish");
    expect(lastText(CHAT.dir)).toContain("01T777TG");
    expect(to(CHAT.spec)).toHaveLength(0);
    expect(to(CHAT.mgrB)).toHaveLength(0);
  });
});

describe("unlinking", () => {
  it("changing the phone in ReysPro drops the link", async () => {
    await db.account.update({ where: { id: ids.accounts[0] }, data: { phone: "+998999970099" } });
    await db.user.update({ where: { id: ids.users.dir }, data: { phone: "+998999970099" } });
    expect(await staffMembers(String(CHAT.dir))).toEqual([]);
    expect((await db.account.findUnique({ where: { id: ids.accounts[0] } }))?.telegramChatId).toBeNull();
  });
  it("blocked member sees nothing; unlink from the account page clears the chat", async () => {
    await db.user.update({ where: { id: ids.users.mgrB }, data: { status: "BLOCKED" } });
    expect(await staffMembers(String(CHAT.mgrB))).toEqual([]);
    await unlinkStaff(ids.accounts[2]);
    expect(await staffMembers(String(CHAT.acc))).toEqual([]);
  });
});
