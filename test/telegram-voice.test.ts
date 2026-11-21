// Telegram bot: ovozli kiritish (21.11.2026). Haqiqiy bazada (DATABASE_URL); Telegram va Cloudflare AI o'rniga soxta server.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { handleUpdate } from "@/lib/telegram-bot";

type Btn = { text: string; callback_data: string };
type Sent = { method: string; body: { chat_id?: number | string; message_id?: number; text?: string; reply_markup?: { inline_keyboard?: Btn[][] } } };
let sent: Sent[] = [];
let aiCalls: { model: string; body: Record<string, unknown> }[] = [];
let server: Server;
let transcript = "Alfa Trans besh ming dollar to'ladi, Kapitalbankka";
let llm: Record<string, unknown> = {};
let msgId = 100;

const P = { dir: "+998999960001", spec: "+998999960002", mgr: "+998999960003" };
const CHAT = { dir: 96001, spec: 96002, mgr: 96003 };
const ids: { org: string; users: Record<string, string>; client: string; trip: string; ship: string; bank: string; cash: string; fuel: string } = {
  org: "", users: {}, client: "", trip: "", ship: "", bank: "", cash: "", fuel: "",
};

let updateId = 1;
const contact = (chat: number, phone: string) =>
  handleUpdate({ update_id: updateId++, message: { message_id: 1, chat: { id: chat, type: "private" }, from: { id: chat + 1 }, contact: { phone_number: phone, user_id: chat + 1 } } } as never);
const voice = (chat: number, duration = 5) =>
  handleUpdate({ update_id: updateId++, message: { message_id: 2, chat: { id: chat, type: "private" }, from: { id: chat + 1 }, voice: { file_id: "f1", duration } } } as never);
const say = (chat: number, text: string) =>
  handleUpdate({ update_id: updateId++, message: { message_id: 3, chat: { id: chat, type: "private" }, from: { id: chat + 1 }, text } } as never);
const press = (chat: number, data: string) =>
  handleUpdate({ update_id: updateId++, callback_query: { id: `q${updateId}`, from: { id: chat + 1 }, data, message: { message_id: 555, chat: { id: chat, type: "private" } } } } as never);

/** Oxirgi kartochka (tugmali xabar): matn va tugmalar. */
function lastCard(chat: number) {
  const m = sent.filter((s) => (s.method === "sendMessage" || s.method === "editMessageText") && String(s.body.chat_id) === String(chat) && s.body.reply_markup?.inline_keyboard?.length).at(-1);
  return { text: m?.body.text ?? "", buttons: (m?.body.reply_markup?.inline_keyboard ?? []).flat() };
}
const lastText = (chat: number) => sent.filter((s) => String(s.body.chat_id) === String(chat) && s.body.text).at(-1)?.body.text ?? "";
const btn = (chat: number, label: string) => lastCard(chat).buttons.find((b) => b.text.includes(label))?.callback_data ?? "";
const answers = () => sent.filter((s) => s.method === "answerCallbackQuery").map((s) => (s.body as { text?: string }).text);

async function cleanup() {
  const orgs = await db.organization.findMany({ where: { name: { startsWith: "TG voice test" } }, select: { id: true } });
  const orgIds = orgs.map((o) => o.id);
  await db.voiceDraft.deleteMany({ where: { orgId: { in: orgIds } } });
  await db.auditLog.deleteMany({ where: { orgId: { in: orgIds } } });
  await db.paymentAllocation.deleteMany({ where: { payment: { orgId: { in: orgIds } } } });
  await db.payment.deleteMany({ where: { orgId: { in: orgIds } } });
  await db.expense.deleteMany({ where: { orgId: { in: orgIds } } });
  await db.expenseCategory.deleteMany({ where: { orgId: { in: orgIds }, parentId: { not: null } } });
  await db.expenseCategory.deleteMany({ where: { orgId: { in: orgIds } } });
  await db.cashAccount.deleteMany({ where: { orgId: { in: orgIds } } });
  await db.shipment.deleteMany({ where: { orgId: { in: orgIds } } });
  await db.trip.deleteMany({ where: { orgId: { in: orgIds } } });
  await db.driver.deleteMany({ where: { orgId: { in: orgIds } } });
  await db.vehicle.deleteMany({ where: { orgId: { in: orgIds } } });
  await db.client.deleteMany({ where: { orgId: { in: orgIds } } });
  await db.orgCurrency.deleteMany({ where: { orgId: { in: orgIds } } });
  const accs = await db.account.findMany({ where: { phone: { in: Object.values(P) } }, select: { id: true } });
  await db.user.deleteMany({ where: { OR: [{ orgId: { in: orgIds } }, { accountId: { in: accs.map((a) => a.id) } }] } });
  await db.account.deleteMany({ where: { id: { in: accs.map((a) => a.id) } } });
  await db.organization.deleteMany({ where: { id: { in: orgIds } } });
}

async function member(key: string, role: "DIRECTOR" | "MANAGER" | "SPECIALIST", phone: string, access?: object) {
  const acc = await db.account.create({ data: { email: `${key}@tg-voice-test.uz`, phone } });
  const u = await db.user.create({ data: { accountId: acc.id, orgId: ids.org, role, phone, fullName: `Voice ${key}`, specialistNo: role === "SPECIALIST" ? 1 : null, access: access ?? undefined } });
  ids.users[key] = u.id;
}

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const url = req.url ?? "";
      res.setHeader("Content-Type", "application/json");
      if (url.startsWith("/file/")) { res.setHeader("Content-Type", "audio/ogg"); res.end(Buffer.from("OggS-fake-audio")); return; }
      const ai = /\/accounts\/acc1\/ai\/run\/(.+)$/.exec(url);
      if (ai) {
        const body = raw ? JSON.parse(raw) : {};
        aiCalls.push({ model: ai[1], body });
        if (req.headers.authorization !== "Bearer tok1") { res.statusCode = 401; res.end(JSON.stringify({ success: false, errors: [{ message: "auth" }] })); return; }
        if (ai[1].includes("whisper")) { res.end(JSON.stringify({ success: true, result: { text: transcript, transcription_info: { language: body.language ?? "tr" } } })); return; }
        res.end(JSON.stringify({ success: true, result: { response: llm } }));
        return;
      }
      const method = url.split("/").pop() ?? "";
      sent.push({ method, body: raw ? JSON.parse(raw) : {} });
      const result = method === "getFile" ? { file_path: "voice/file_1.oga" } : { message_id: ++msgId };
      res.end(JSON.stringify({ ok: true, result }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  process.env.TELEGRAM_API_URL = base;
  process.env.CF_AI_API_URL = base;
  process.env.CF_ACCOUNT_ID = "acc1";
  process.env.CF_AI_TOKEN = "tok1";
  process.env.APP_URL = "https://crm.test";

  await cleanup();
  ids.org = (await db.organization.create({ data: { name: "TG voice test", cashEnabled: true } })).id;
  await member("dir", "DIRECTOR", P.dir);
  await member("spec", "SPECIALIST", P.spec, { trips: "VIEW" });
  await member("mgr", "MANAGER", P.mgr);
  const veh = await db.vehicle.create({ data: { orgId: ids.org, plate: "01V111TG", type: "TRACTOR" } });
  const drv = await db.driver.create({ data: { orgId: ids.org, fullName: "Haydovchi V", category: "EMPLOYEE" } });
  ids.trip = (await db.trip.create({ data: { orgId: ids.org, number: 42, routeFrom: "Toshkent (Uzbekistan)", routeTo: "Riga (Latvia)", tractorId: veh.id, driverId: drv.id, loadDate: new Date(Date.UTC(2026, 10, 1)), createdById: ids.users.dir } })).id;
  ids.client = (await db.client.create({ data: { orgId: ids.org, name: "Alfa Trans" } })).id;
  await db.client.create({ data: { orgId: ids.org, name: "Beta Logistik" } });
  ids.ship = (await db.shipment.create({ data: { orgId: ids.org, tripId: ids.trip, clientId: ids.client, contactName: "K", contactPhone: "+998900000000", terms: "CONTRACT", price: 3000, currency: "USD", createdById: ids.users.dir } })).id;
  ids.bank = (await db.cashAccount.create({ data: { orgId: ids.org, kind: "BANK", name: "Kapitalbank", mfo: "01234", accountNumber: "20208840000000001234", currency: "USD", createdById: ids.users.dir } })).id;
  ids.cash = (await db.cashAccount.create({ data: { orgId: ids.org, kind: "CASH", name: "Kassa", currency: "UZS", createdById: ids.users.dir } })).id;
  ids.fuel = (await db.expenseCategory.create({ data: { orgId: ids.org, name: "Yoqilg'i" } })).id;
  for (const [chat, phone] of [[CHAT.dir, P.dir], [CHAT.spec, P.spec], [CHAT.mgr, P.mgr]] as const) await contact(chat, phone);
});

afterAll(async () => {
  await cleanup();
  await new Promise((r) => server.close(r));
  await db.$disconnect();
});

beforeEach(() => {
  sent = [];
  aiCalls = [];
});

describe("ovozli to'lov", () => {
  it("ovoz → matn → qoralama; tasdiqlanmaguncha hech narsa yozilmaydi", async () => {
    llm = { intent: "payment", client: 1, client_text: "Alfa Trans", amount: 5000, currency: "USD", account: 1 };
    await voice(CHAT.mgr);
    // Whisper tilni "tr" deb topdi → o'zbek tili majburan qayta so'raladi; mijoz nomlari ishora sifatida beriladi.
    const stt = aiCalls.filter((c) => c.model.includes("whisper"));
    expect(stt).toHaveLength(2);
    expect(stt[1].body.language).toBe("uz");
    expect(String(stt[0].body.initial_prompt)).toContain("Alfa Trans");
    expect(stt[0].body.audio).toBe(Buffer.from("OggS-fake-audio").toString("base64"));
    const llmCall = aiCalls.find((c) => c.model.includes("llama"))!;
    expect(JSON.stringify(llmCall.body.messages)).toContain("1. Alfa Trans");
    const card = lastCard(CHAT.mgr);
    expect(card.text).toContain("Mijozdan to'lov");
    expect(card.text).toContain("Alfa Trans");
    expect(card.text).toContain("5 000 USD");
    expect(card.text).toContain("Kapitalbank");
    expect(card.buttons.map((b) => b.text)).toEqual(["✅ Tasdiqlash", "✏️ Tuzatish", "❌ Bekor"]);
    expect(await db.payment.count({ where: { orgId: ids.org } })).toBe(0);
    expect(await db.voiceDraft.count({ where: { orgId: ids.org, status: "PENDING" } })).toBe(1);
  });

  it("boshqa chat tasdiqlay olmaydi; tasdiqlash to'lovni yozadi va qarzga taqsimlaydi, ikkinchi bosish takrorlamaydi", async () => {
    const draft = await db.voiceDraft.findFirstOrThrow({ where: { orgId: ids.org, status: "PENDING" } });
    const ok = `vd:${draft.id}:ok`;
    await press(CHAT.dir, ok);
    expect(answers().at(-1)).toBe("Bu qoralama sizga tegishli emas.");
    expect(await db.payment.count({ where: { orgId: ids.org } })).toBe(0);
    await press(CHAT.mgr, ok);
    await press(CHAT.mgr, ok);
    const pays = await db.payment.findMany({ where: { orgId: ids.org }, include: { allocations: true } });
    expect(pays).toHaveLength(1);
    expect(pays[0]).toMatchObject({ clientId: ids.client, currency: "USD", method: "BANK", accountId: ids.bank, createdById: ids.users.mgr });
    expect(Number(pays[0].amount)).toBe(5000);
    expect(pays[0].allocations.map((a) => [a.shipmentId, Number(a.applied)])).toEqual([[ids.ship, 3000]]);
    const log = await db.auditLog.findFirst({ where: { orgId: ids.org, action: "payment.create" } });
    expect(log?.details).toMatchObject({ source: "telegram-voice" });
    expect(answers()).toContain("Saqlandi ✅");
    expect(answers().at(-1)).toBe("Allaqachon saqlangan.");
    expect(lastText(CHAT.mgr)).toContain("Dasturga yozildi");
    expect(lastText(CHAT.mgr)).toContain(`https://crm.test/clients/${ids.client}`);
  });

  it("mijoz topilmasa — o'xshashlari tugma; tanlangach tasdiqlash chiqadi", async () => {
    llm = { intent: "payment", client: null, client_text: "Alfa", amount: 100, currency: "USD", account: 1 };
    await voice(CHAT.mgr);
    let card = lastCard(CHAT.mgr);
    expect(card.text).toContain("Yetishmayapti: mijoz");
    expect(card.buttons.map((b) => b.text)).toEqual(["Alfa Trans", "✏️ Tuzatish", "❌ Bekor"]);
    await press(CHAT.mgr, card.buttons[0].callback_data);
    card = lastCard(CHAT.mgr);
    expect(card.text).toContain("👥 Mijoz: <b>Alfa Trans</b>");
    expect(card.buttons[0].text).toBe("✅ Tasdiqlash");
    await press(CHAT.mgr, btn(CHAT.mgr, "Bekor"));
    expect(lastText(CHAT.mgr)).toContain("Bekor qilindi");
    expect(await db.payment.count({ where: { orgId: ids.org } })).toBe(1);
  });

  it("«Tuzatish» → matn bilan tuzatish: AI avvalgi qoralamani oladi, o'sha qoralama yangilanadi", async () => {
    llm = { intent: "payment", client: 2, amount: 700, currency: "USD", account: 1 };
    await voice(CHAT.mgr);
    const draftId = btn(CHAT.mgr, "Tuzatish").split(":")[1];
    await press(CHAT.mgr, btn(CHAT.mgr, "Tuzatish"));
    expect(lastText(CHAT.mgr)).toContain("Nimani o'zgartiramiz?");
    llm = { intent: "payment", client: 2, amount: 750, currency: "USD", account: 1 };
    aiCalls = [];
    await say(CHAT.mgr, "summa 750 dollar");
    expect(JSON.stringify(aiCalls[0].body.messages)).toContain("Tuzatish: «summa 750 dollar»");
    const d = await db.voiceDraft.findUnique({ where: { id: draftId } });
    expect(d?.status).toBe("PENDING");
    expect((d?.data as { amount: number }).amount).toBe(750);
    expect(lastCard(CHAT.mgr).text).toContain("750 USD");
    // Tuzatishdan keyin oddiy matn yana qidiruvga ketadi.
    aiCalls = [];
    await say(CHAT.mgr, "Alfa");
    expect(aiCalls).toHaveLength(0);
  });
});

describe("ovozli xarajat", () => {
  it("reys raqami, kassa hisobi va turkum bilan xarajat yoziladi", async () => {
    transcript = "42-reysga yoqilg'i uchun 300 ming so'm, kassadan";
    llm = { intent: "expense", amount: 300000, currency: "UZS", category: 1, category_text: "yoqilg'i", trip: 42 };
    await voice(CHAT.mgr);
    const card = lastCard(CHAT.mgr);
    expect(card.text).toContain("Xarajat");
    expect(card.text).toContain("TSH-0042");
    expect(card.text).toContain("Kassa · UZS");
    await press(CHAT.mgr, btn(CHAT.mgr, "Tasdiqlash"));
    const e = await db.expense.findFirst({ where: { orgId: ids.org } });
    expect(e).toMatchObject({ accountId: ids.cash, categoryId: ids.fuel, tripId: ids.trip, createdById: ids.users.mgr });
    expect(Number(e?.amount)).toBe(300000);
  });
  it("topilmagan reys raqami — tasdiqlash tugmasi chiqmaydi", async () => {
    llm = { intent: "expense", amount: 1000, currency: "UZS", category: 1, trip: 999 };
    await voice(CHAT.mgr);
    const card = lastCard(CHAT.mgr);
    expect(card.text).toContain("999 topilmadi");
    expect(card.buttons.some((b) => b.text.includes("Tasdiqlash"))).toBe(false);
  });
});

describe("cheklovlar", () => {
  it("kiritish huquqi yo'q mutaxassis — AI chaqirilmaydi", async () => {
    await voice(CHAT.spec);
    expect(aiCalls).toHaveLength(0);
    expect(lastText(CHAT.spec)).toContain("kiritish huquqi bor xodimlar uchun");
  });
  it("rahbar (faqat ko'radi) ham ovoz bilan kirita olmaydi", async () => {
    await voice(CHAT.dir);
    expect(aiCalls).toHaveLength(0);
    expect(lastText(CHAT.dir)).toContain("kiritish huquqi bor xodimlar uchun");
  });
  it("2 daqiqadan uzun ovoz qabul qilinmaydi", async () => {
    await voice(CHAT.mgr, 200);
    expect(aiCalls).toHaveLength(0);
    expect(lastText(CHAT.mgr)).toContain("daqiqadan oshmasin");
  });
  it("ulanmagan foydalanuvchi ovozi e'tiborsiz", async () => {
    await voice(96099);
    expect(aiCalls).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });
  it("AI sozlanmagan bo'lsa — xabar", async () => {
    const t = process.env.CF_AI_TOKEN;
    delete process.env.CF_AI_TOKEN;
    await voice(CHAT.mgr);
    process.env.CF_AI_TOKEN = t;
    expect(lastText(CHAT.mgr)).toContain("hali sozlanmagan");
  });
  it("AI xatosi — foydalanuvchiga tushunarli xabar", async () => {
    const t = process.env.CF_AI_TOKEN;
    process.env.CF_AI_TOKEN = "wrong";
    await voice(CHAT.mgr);
    process.env.CF_AI_TOKEN = t;
    expect(lastText(CHAT.mgr)).toContain("qayta ishlab bo'lmadi");
  });
});
