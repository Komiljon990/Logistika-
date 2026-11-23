// Super Admin boti (23.11.2026): ulanish, tugmalar, xabarlar. Haqiqiy baza, soxta Telegram serveri.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { adminBotChats, handleAdminUpdate, sendAdminDigest, sendToAdminBot } from "@/lib/telegram-admin";
import { notifyAdmin } from "@/lib/telegram";

type Sent = { token: string; method: string; body: { chat_id?: number | string; text?: string; reply_markup?: { keyboard?: { text: string }[][] } } };
let sent: Sent[] = [];
let server: Server;
const PHONE = { admin: "+998999950001", other: "+998999950002" };
const CHAT = { admin: 95001, other: 95002 };
const ids = { adminUser: "", account: "", org: "", demo: "" };
let updateId = 1;
const contact = (chat: number, phone: string) =>
  handleAdminUpdate({ update_id: updateId++, message: { message_id: 1, chat: { id: chat, type: "private" }, from: { id: chat + 1 }, contact: { phone_number: phone, user_id: chat + 1 } } });
const say = (chat: number, text: string) =>
  handleAdminUpdate({ update_id: updateId++, message: { message_id: 1, chat: { id: chat, type: "private" }, from: { id: chat + 1 }, text } });
const to = (chat: number) => sent.filter((s) => s.method === "sendMessage" && String(s.body.chat_id) === String(chat));
const last = (chat: number) => to(chat).at(-1)?.body.text ?? "";

async function cleanup() {
  const orgIds = (await db.organization.findMany({ where: { name: { startsWith: "AdminBot test" } }, select: { id: true } })).map((o) => o.id);
  await db.invoice.deleteMany({ where: { orgId: { in: orgIds } } });
  await db.vehicle.deleteMany({ where: { orgId: { in: orgIds } } });
  await db.orgApplication.deleteMany({ where: { email: { endsWith: "@adminbot-test.uz" } } });
  const accs = await db.account.findMany({ where: { email: { endsWith: "@adminbot-test.uz" } }, select: { id: true } });
  await db.user.deleteMany({ where: { accountId: { in: accs.map((a) => a.id) } } });
  await db.account.deleteMany({ where: { id: { in: accs.map((a) => a.id) } } });
  await db.organization.deleteMany({ where: { id: { in: orgIds } } });
  await db.appSetting.deleteMany({ where: { key: { in: ["adminBotChats", "telegramChatId"] } } });
}

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const parts = (req.url ?? "").split("/");
      sent.push({ token: parts.at(-2) ?? "", method: parts.at(-1) ?? "", body: raw ? JSON.parse(raw) : {} });
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, result: { message_id: 1 } }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.TELEGRAM_BOT_TOKEN = "main-token";
  process.env.SUPERADMIN_BOT_TOKEN = "admin-token";
  process.env.TELEGRAM_ADMIN_CHAT_ID = "";
  process.env.TELEGRAM_API_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.APP_URL = "https://crm.test";
  await cleanup();
  const acc = await db.account.create({ data: { email: "sa@adminbot-test.uz", phone: PHONE.admin } });
  ids.account = acc.id;
  ids.adminUser = (await db.user.create({ data: { accountId: acc.id, role: "SUPER_ADMIN", phone: "", fullName: "Platforma egasi" } })).id;
  const org = await db.organization.create({ data: { name: "AdminBot test Org", subEnd: new Date(Date.now() + 3 * 86_400_000) } });
  ids.org = org.id;
  const demo = await db.organization.create({ data: { name: "AdminBot test Demo", isDemo: true, subEnd: new Date() } });
  ids.demo = demo.id;
  await db.vehicle.create({ data: { orgId: org.id, plate: "01A001AB", type: "TRACTOR" } });
  await db.orgApplication.create({ data: { orgName: "AdminBot test Yangi", inn: "999888777", directorName: "Ali", phone: "+998901112233", email: "new@adminbot-test.uz", plan: "T10", period: "MONTHLY", offerVersion: "x", offerAcceptedAt: new Date() } });
  await db.invoice.create({ data: { orgId: org.id, kind: "RENEWAL", plan: "T10", period: "MONTHLY", periodStart: new Date(), periodEnd: new Date(), baseAmount: 200000, amount: 150000, status: "REVIEW", receiptAt: new Date() } });
  await db.invoice.create({ data: { orgId: demo.id, kind: "RENEWAL", plan: "T10", period: "MONTHLY", periodStart: new Date(), periodEnd: new Date(), baseAmount: 200000, amount: 150000, status: "REVIEW", receiptAt: new Date() } });
});

afterAll(async () => {
  await cleanup();
  await new Promise((r) => server.close(r));
  await db.$disconnect();
});

beforeEach(() => { sent = []; });

describe("super admin bot", () => {
  it("refuses phones that are not a Super Admin", async () => {
    await contact(CHAT.other, PHONE.other);
    expect(last(CHAT.other)).toContain("faqat ReysPro platformasi egasi");
    await say(CHAT.other, "🆕 Arizalar");
    expect(last(CHAT.other)).toContain("Ulanish uchun");
    expect(await adminBotChats()).toEqual([]);
  });

  it("links the Super Admin by account phone and uses only the admin bot token", async () => {
    await contact(CHAT.admin, PHONE.admin);
    expect(last(CHAT.admin)).toContain("Siz ulandingiz: Platforma egasi");
    expect(to(CHAT.admin).at(-1)!.body.reply_markup?.keyboard?.flat().map((b) => b.text)).toEqual(
      ["📊 Umumiy holat", "🆕 Arizalar", "🧾 To'lovlar", "🏢 Tashkilotlar", "⏳ Obunasi tugayotganlar"]);
    expect(sent.every((s) => s.token === "botadmin-token")).toBe(true);
    expect(await adminBotChats()).toEqual([String(CHAT.admin)]);
  });

  it("shows applications, payments, orgs and ending subscriptions without demo data", async () => {
    await say(CHAT.admin, "🆕 Arizalar");
    expect(last(CHAT.admin)).toContain("AdminBot test Yangi (STIR 999888777)");
    expect(last(CHAT.admin)).toContain("https://crm.test/admin/applications/");
    await say(CHAT.admin, "🧾 To'lovlar");
    expect(last(CHAT.admin)).toContain("AdminBot test Org");
    expect(last(CHAT.admin)).not.toContain("Demo");
    await say(CHAT.admin, "🏢 Tashkilotlar");
    expect(last(CHAT.admin)).toContain("AdminBot test Org\n  🚛 1 ta");
    expect(last(CHAT.admin)).not.toContain("AdminBot test Demo");
    await say(CHAT.admin, "⏳ Obunasi tugayotganlar");
    expect(last(CHAT.admin)).toMatch(/AdminBot test Org — .* \(\d kun qoldi\)/);
    await say(CHAT.admin, "📊 Umumiy holat");
    expect(last(CHAT.admin)).toContain("Kutayotgan arizalar:");
  });

  it("routes notifyAdmin and the daily digest to the admin bot", async () => {
    expect(await notifyAdmin("🆕 Yangi ariza sinov")).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0].token).toBe("botadmin-token");
    expect(sent[0].body.text).toBe("🆕 Yangi ariza sinov");
    expect(await sendAdminDigest()).toBe(true);
    expect(last(CHAT.admin)).toContain("Xayrli tong");
  });

  it("ignores group chats and drops chats of a blocked Super Admin", async () => {
    await handleAdminUpdate({ update_id: updateId++, message: { message_id: 1, chat: { id: -95009, type: "group" }, text: "📊 Umumiy holat" } });
    expect(sent).toHaveLength(0);
    await db.user.update({ where: { id: ids.adminUser }, data: { status: "ARCHIVED" } });
    expect(await adminBotChats()).toEqual([]);
    expect(await sendToAdminBot("x")).toBe(false);
    await db.user.update({ where: { id: ids.adminUser }, data: { status: "ACTIVE" } });
  });
});
