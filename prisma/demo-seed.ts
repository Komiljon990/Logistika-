/**
 * Demo (reklama) tashkiloti: namunaviy ma'lumotlar va 3 ta demo hisob (rahbar, menejer, buxgalter).
 * Demo hisoblar hech narsani saqlay olmaydi (src/lib/session.ts), faqat shu tashkilotni ko'radi.
 *
 * Ishga tushirish:  DEMO_PASSWORD="..." npm run db:demo
 * Qayta ishga tushirilsa demo tashkilot ma'lumotlari tozalanib, qaytadan yaratiladi (haqiqiy tashkilotlarga tegilmaydi).
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const db = new PrismaClient();
const ORG_NAME = "ReysPro Demo Logistics";
const USERS = [
  { phone: "+998000000001", fullName: "Demo Rahbar", role: "DIRECTOR" as const },
  { phone: "+998000000002", fullName: "Demo Menejer", role: "MANAGER" as const },
  { phone: "+998000000003", fullName: "Demo Buxgalter", role: "ACCOUNTANT" as const },
];

const today = () => {
  const t = new Date(Date.now() + 5 * 3_600_000);
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
};
const day = (n: number) => new Date(today().getTime() + n * 86_400_000);
const at = (n: number, hour: number) => new Date(day(n).getTime() + (hour - 5) * 3_600_000);

async function wipe(orgId: string) {
  await db.auditLog.deleteMany({ where: { orgId } });
  await db.expense.deleteMany({ where: { orgId } });
  await db.cashTransfer.deleteMany({ where: { orgId } });
  await db.paymentAllocation.deleteMany({ where: { payment: { orgId } } });
  await db.payment.deleteMany({ where: { orgId } });
  await db.cashAccount.deleteMany({ where: { orgId } });
  await db.expenseCategory.deleteMany({ where: { orgId, NOT: { parentId: null } } });
  await db.expenseCategory.deleteMany({ where: { orgId } });
  await db.shipmentCharge.deleteMany({ where: { orgId } });
  await db.document.updateMany({ where: { orgId }, data: { prevId: null } });
  await db.document.deleteMany({ where: { orgId } });
  await db.storedFile.deleteMany({ where: { orgId } });
  await db.tripEvent.deleteMany({ where: { trip: { orgId } } });
  await db.shipment.deleteMany({ where: { orgId } });
  await db.trip.deleteMany({ where: { orgId } });
  await db.client.deleteMany({ where: { orgId } });
  await db.vehicle.updateMany({ where: { orgId }, data: { pairTrailerId: null, pairDriverId: null } });
  await db.vehicle.deleteMany({ where: { orgId } });
  await db.driver.deleteMany({ where: { orgId } });
  await db.orgCurrency.deleteMany({ where: { orgId } });
}

async function main() {
  const password = process.env.DEMO_PASSWORD ?? "";
  if (password.length < 8) throw new Error("DEMO_PASSWORD (kamida 8 belgi) berilishi kerak");

  let org = await db.organization.findFirst({ where: { name: ORG_NAME } });
  if (org) await wipe(org.id);
  else org = await db.organization.create({ data: { name: ORG_NAME, inn: "309999999", phone: "+998 71 200 00 00", address: "Toshkent sh., Yashnobod tumani" } });
  const orgId = org.id;

  const hash = await hashPassword(password);
  const ids: Record<string, string> = {};
  for (const u of USERS) {
    const row = await db.user.upsert({
      where: { phone: u.phone },
      update: { fullName: u.fullName, role: u.role, orgId, isDemo: true, status: "ACTIVE", passwordHash: hash, failedLogins: 0, lockedUntil: null },
      create: { ...u, orgId, isDemo: true, passwordHash: hash },
    });
    ids[u.role] = row.id;
  }
  const by = ids.MANAGER;

  await db.orgCurrency.createMany({ data: ["UZS", "USD", "EUR", "RUB", "KZT"].map((code) => ({ orgId, code })) });

  // Haydovchilar
  const drv = async (fullName: string, phone: string, category: "EMPLOYEE" | "OWNER_OPERATOR") =>
    (await db.driver.create({ data: { orgId, fullName, phone, category } })).id;
  const d1 = await drv("Karimov Aziz", "+998901112201", "EMPLOYEE");
  const d2 = await drv("Tursunov Bekzod", "+998901112202", "EMPLOYEE");
  const d3 = await drv("Rahimov Sardor", "+998901112203", "OWNER_OPERATOR");
  const d4 = await drv("Yusupov Jamshid", "+998901112204", "EMPLOYEE");

  // Transport: tyagach + prisept juftliklari
  const veh = async (data: Omit<Prisma.VehicleUncheckedCreateInput, "orgId">) => (await db.vehicle.create({ data: { orgId, ...data } })).id;
  const tr1 = await veh({ plate: "01D101DM", type: "TRAILER", model: "Schmitz Cargobull" });
  const tr2 = await veh({ plate: "01D102DM", type: "TRAILER", model: "Krone" });
  const tr3 = await veh({ plate: "01D103DM", type: "TRAILER", model: "Kögel", ownership: "LEASED", leaseOwner: "Trans Lizing MChJ", leaseStart: day(-340), leaseEnd: day(25) });
  const t1 = await veh({ plate: "01D001DM", type: "TRACTOR", model: "Volvo FH 500", pairTrailerId: tr1, pairDriverId: d1 });
  const t2 = await veh({ plate: "01D002DM", type: "TRACTOR", model: "MAN TGX", pairTrailerId: tr2, pairDriverId: d2 });
  const t3 = await veh({ plate: "01D003DM", type: "TRACTOR", model: "DAF XF", pairTrailerId: tr3, pairDriverId: d3 });
  const t4 = await veh({ plate: "01D004DM", type: "TRACTOR", model: "Mercedes Actros", pairDriverId: d4 });

  // Hujjatlar (ba'zilari muddati yaqin — ogohlantirishlar uchun)
  const doc = (data: Omit<Prisma.DocumentUncheckedCreateInput, "orgId" | "createdById">) =>
    db.document.create({ data: { orgId, createdById: by, ...data } });
  for (const [vid, n] of [[t1, 1], [t2, 2], [t3, 3], [t4, 4]] as const) {
    await doc({ vehicleId: vid, type: "TECH_PASSPORT", number: `AAF 00${n}5${n}1`, issuedAt: day(-700) });
    await doc({ vehicleId: vid, type: "LICENSE", number: `LIT-2026-0${n}`, issuedAt: day(-200), expiresAt: day(160 + n * 10) });
  }
  await doc({ vehicleId: t1, type: "INSURANCE", number: "SUG-77812", issuedAt: day(-360), expiresAt: day(5) });
  await doc({ vehicleId: t2, type: "INSPECTION", number: "KO-4471", issuedAt: day(-170), expiresAt: day(12) });
  await doc({ vehicleId: t3, type: "INSURANCE", number: "SUG-77905", issuedAt: day(-380), expiresAt: day(-2) });
  await doc({ vehicleId: t4, type: "OTHER", title: "Ekologik sertifikat (Euro 6)", number: "EKO-6-112", expiresAt: day(28) });
  await doc({ driverId: d1, type: "DRIVING_LICENSE", number: "AF 1234567", expiresAt: day(900) });
  await doc({ driverId: d1, type: "FOREIGN_PASSPORT", number: "FA 7654321", expiresAt: day(14) });
  await doc({ driverId: d2, type: "PASSPORT", number: "AB 2223334", expiresAt: day(2000) });
  await doc({ driverId: d3, type: "ADR", number: "ADR-5512", expiresAt: day(40) });
  await doc({ type: "CHARTER", number: "Ustav 2024", noExpiry: true });
  await doc({ type: "ORG_CERTIFICATE", number: "Guvohnoma № 1123456", issuedAt: day(-900), noExpiry: true });
  await doc({ type: "BANK_DETAILS", number: "20208000900123456001", note: "Kapitalbank, MFO 01018" });
  await doc({ type: "LICENSE", number: "AT-000777", expiresAt: day(20) });

  // Mijozlar
  const cli = async (name: string, inn: string) => (await db.client.create({ data: { orgId, name, inn } })).id;
  const c1 = await cli("Navbahor Tekstil MChJ", "301234567");
  const c2 = await cli("Samarqand Agro Eksport", "305998120");
  const c3 = await cli("Euro Cargo Partner", "");
  const c4 = await cli("Farg'ona Mebel Group", "307410002");

  // Tashishlar
  let num = 0;
  const trip = async (data: { tractor: string; trailer?: string; driver: string; from: string; to: string; load: number; cargo: string; status?: "ACTIVE" | "COMPLETED" | "CANCELLED" }) =>
    (await db.trip.create({
      data: {
        orgId, number: ++num, tractorId: data.tractor, trailerId: data.trailer ?? null, driverId: data.driver,
        routeFrom: data.from, routeTo: data.to, loadDate: day(data.load), cargo: data.cargo, status: data.status ?? "ACTIVE", createdById: by,
      },
    })).id;
  const events = (tripId: string, list: [Prisma.TripEventCreateManyInput["type"], number, number, ("DRIVER" | "MANAGER")?][]) =>
    db.tripEvent.createMany({ data: list.map(([type, d, h, source]) => ({ tripId, type, at: at(d, h), source: source ?? "DRIVER", userId: source === "MANAGER" ? by : null })) });
  const ship = async (tripId: string, data: { client: string; contact: string; phone: string; terms: "CONTRACT" | "CASH"; price: number; currency: string; acc?: number; cargo?: string }) =>
    (await db.shipment.create({
      data: {
        orgId, tripId, clientId: data.client, contactName: data.contact, contactPhone: data.phone, terms: data.terms, price: data.price, currency: data.currency,
        accountingPrice: data.acc ?? null, accountingCurrency: data.acc ? "UZS" : null, cargo: data.cargo ?? null, createdById: by,
      },
    })).id;

  // 1) Yakunlangan xorijiy tashish
  const tA = await trip({ tractor: t2, trailer: tr2, driver: d2, from: "Toshkent", to: "Riga", load: -30, cargo: "Paxta kalavasi", status: "COMPLETED" });
  await events(tA, [["ACCEPTED", -31, 18], ["ARRIVED_LOADING", -30, 8], ["LOADED", -30, 14], ["EXITED_UZ", -29, 9], ["ARRIVED_UNLOADING", -22, 10], ["UNLOADED", -22, 16], ["ENTERED_UZ", -16, 11, "MANAGER"]]);
  const sA = await ship(tA, { client: c1, contact: "Rustam Aliyev", phone: "+998901112233", terms: "CONTRACT", price: 3000, currency: "USD", acc: 36_000_000, cargo: "Paxta kalavasi, 20 t" });

  // 2) Yo'lda: Toshkent → Varshava, ikki yuk (biri qo'shimcha yuk)
  const tB = await trip({ tractor: t1, trailer: tr1, driver: d1, from: "Toshkent", to: "Varshava", load: -11, cargo: "Tekstil, quritilgan meva" });
  await events(tB, [["ACCEPTED", -12, 18], ["ARRIVED_LOADING", -11, 8], ["LOADED", -11, 13], ["EXITED_UZ", -10, 9, "MANAGER"]]);
  const sB1 = await ship(tB, { client: c1, contact: "Rustam Aliyev", phone: "+998901112233", terms: "CONTRACT", price: 3000, currency: "USD", acc: 38_000_000, cargo: "Tekstil, 12 t" });
  const sB2 = await ship(tB, { client: c3, contact: "Anna Kowalska", phone: "+48600123456", terms: "CASH", price: 1200, currency: "EUR", cargo: "Quritilgan meva, 8 t" });
  await db.shipmentCharge.createMany({
    data: [
      { orgId, shipmentId: sB1, kind: "EXTRA", amount: 150, description: "Qo'shimcha bojxona xizmati", date: day(-9), createdById: by },
      { orgId, shipmentId: sB1, kind: "DEMURRAGE", days: 2, dailyAmount: 50, amount: 100, description: "Yuklashda kutish", date: day(-11), createdById: by },
    ],
  });
  const tbDocs = [["WAYBILL", "PUT-0002"], ["CMR", "CMR-882211"], ["DAZVOL", "PL-2026-0311"]] as const;
  for (const [type, number] of tbDocs) await doc({ tripId: tB, type, number });

  // 3) Yuklanmoqda: Toshkent → Almati
  const tC = await trip({ tractor: t3, trailer: tr3, driver: d3, from: "Toshkent", to: "Almati", load: -1, cargo: "Qishloq xo'jaligi mahsuloti" });
  await events(tC, [["ACCEPTED", -2, 20], ["ARRIVED_LOADING", -1, 9]]);
  const sC = await ship(tC, { client: c2, contact: "Jasur Toshmatov", phone: "+998912223344", terms: "CONTRACT", price: 2800, currency: "USD", cargo: "Quritilgan meva, 18 t" });

  // 4) Ichki tashish, yakunlangan: Toshkent → Termiz
  const tD = await trip({ tractor: t4, driver: d4, from: "Toshkent", to: "Termiz", load: -20, cargo: "Mebel", status: "COMPLETED" });
  await events(tD, [["ACCEPTED", -21, 17], ["ARRIVED_LOADING", -20, 8], ["LOADED", -20, 12], ["ARRIVED_UNLOADING", -19, 15], ["UNLOADED", -19, 18]]);
  const sD = await ship(tD, { client: c4, contact: "Otabek Nazarov", phone: "+998935556677", terms: "CONTRACT", price: 21_500_000, currency: "UZS" });

  // 5) Yangi tashish: haydovchi hali qabul qilmagan
  const tE = await trip({ tractor: t4, driver: d4, from: "Andijon", to: "Moskva", load: 1, cargo: "Mebel" });
  await ship(tE, { client: c4, contact: "Otabek Nazarov", phone: "+998935556677", terms: "CASH", price: 2600, currency: "USD" });

  // 6) Bekor qilingan
  const tF = await trip({ tractor: t2, trailer: tr2, driver: d2, from: "Samarqand", to: "Istanbul", load: -5, cargo: "Tekstil", status: "CANCELLED" });
  await ship(tF, { client: c2, contact: "Jasur Toshmatov", phone: "+998912223344", terms: "CONTRACT", price: 3200, currency: "USD" });

  // Kassa: hisoblar (bank, naqd kassa, karta)
  const acct = async (data: Omit<Prisma.CashAccountUncheckedCreateInput, "orgId" | "createdById">) => (await db.cashAccount.create({ data: { orgId, createdById: ids.ACCOUNTANT, ...data } })).id;
  const bankUzs = await acct({ kind: "BANK", name: "Kapitalbank", mfo: "01018", accountNumber: "20208000900123456001", currency: "UZS", openingBalance: 45_000_000 });
  const bankUsd = await acct({ kind: "BANK", name: "Kapitalbank", mfo: "01018", accountNumber: "20208840900123456002", currency: "USD", openingBalance: 2_000 });
  const cashUzs = await acct({ kind: "CASH", name: "Asosiy kassa", currency: "UZS", openingBalance: 8_000_000 });
  const cashUsd = await acct({ kind: "CASH", name: "Valyuta kassa", currency: "USD", openingBalance: 1_500 });
  await acct({ kind: "CASH", name: "Valyuta kassa", currency: "EUR", openingBalance: 0, note: "Yevroda naqd tushumlar" });
  const card = await acct({ kind: "CARD", name: "Humo", cardNumber: "9860120123456789", cardHolder: "Rahbar — A. Karimov", currency: "UZS", openingBalance: 3_000_000 });

  // To'lovlar
  const pay = async (data: { client: string; d: number; amount: number; currency: string; method: "BANK" | "CASH" | "CARD"; receivedBy?: "OFFICE" | "DRIVER"; driver?: string; handed?: boolean; note?: string; account?: string },
    alloc: { shipment: string; applied: number; rate: number; manual?: boolean }[]) => {
    const p = await db.payment.create({
      data: {
        orgId, clientId: data.client, date: day(data.d), amount: data.amount, currency: data.currency, method: data.method,
        receivedBy: data.receivedBy ?? null, driverId: data.driver ?? null, handedOverAt: data.handed ? at(data.d + 1, 10) : null, note: data.note ?? null, accountId: data.account ?? null, createdById: by,
      },
    });
    if (alloc.length) {
      await db.paymentAllocation.createMany({
        data: alloc.map((a) => ({ paymentId: p.id, shipmentId: a.shipment, applied: a.applied, rate: a.rate, rateManual: !!a.manual, consumed: Math.round(a.applied * a.rate * 100) / 100 })),
      });
    }
    return p.id;
  };
  const p1 = await pay({ client: c1, d: -15, amount: 3000, currency: "USD", method: "BANK", account: bankUsd }, [{ shipment: sA, applied: 3000, rate: 1 }]);
  // Narx dollarda, to'lov so'mda — kelishilgan kurs bilan
  const p2 = await pay({ client: c1, d: -3, amount: 25_600_000, currency: "UZS", method: "BANK", note: "Kelishilgan kurs 12 800", account: bankUzs }, [{ shipment: sB1, applied: 2000, rate: 12800, manual: true }]);
  // Naqd kelishuv: haydovchi oldi, kassaga hali topshirmagan
  await pay({ client: c3, d: -2, amount: 1200, currency: "EUR", method: "CASH", receivedBy: "DRIVER", driver: d1 }, [{ shipment: sB2, applied: 1200, rate: 1 }]);
  // Qisman to'lov + avans
  await pay({ client: c4, d: -17, amount: 15_000_000, currency: "UZS", method: "BANK", account: bankUzs }, [{ shipment: sD, applied: 15_000_000, rate: 1 }]);
  const p5 = await pay({ client: c2, d: -1, amount: 500, currency: "USD", method: "BANK", note: "Avans", account: bankUsd }, []);
  void sC;

  // Xarajat turkumlari (turkum › bo'lim) va xarajatlar
  const cats: Record<string, string> = {};
  for (const [name, subs] of [
    ["Yoqilg'i", ["Dizel", "Gaz", "AdBlue"]],
    ["Ta'mirlash va xizmat", ["Ehtiyot qismlar", "Shina", "Moy almashtirish", "Usta xizmati"]],
    ["Yo'l xarajatlari", ["Bojxona", "Yo'l haqi", "Jarima", "To'xtash joyi"]],
    ["Ish haqi", ["Haydovchilar", "Ofis xodimlari"]],
    ["Ofis", ["Ijara", "Kommunal", "Aloqa va internet"]],
    ["Soliq va bank", ["Soliqlar", "Bank xizmati"]],
  ] as const) {
    const parent = await db.expenseCategory.create({ data: { orgId, name } });
    for (const s of subs) cats[s] = (await db.expenseCategory.create({ data: { orgId, name: s, parentId: parent.id } })).id;
  }
  const exp = async (sub: string, account: string, amount: number, d: number, note?: string) =>
    (await db.expense.create({ data: { orgId, categoryId: cats[sub], accountId: account, amount, date: day(d), note: note ?? null, createdById: ids.ACCOUNTANT } })).id;
  await exp("Ijara", bankUzs, 5_000_000, -35, "Ofis ijarasi");
  const e1 = await exp("Dizel", bankUzs, 4_200_000, -12, "01D001DM, Toshkent AYOQSH");
  await exp("Bojxona", cashUsd, 350, -10, "Yallama posti, 01D001DM");
  await exp("Shina", bankUzs, 6_800_000, -8, "01D002DM, 2 dona");
  await exp("Haydovchilar", bankUzs, 12_000_000, -5, "Oktabr oyi");
  await exp("Aloqa va internet", card, 450_000, -4);
  const e2 = await exp("Jarima", cashUzs, 300_000, -3, "Tezlik oshirilgani uchun");
  const tr = async (from: string, to: string, amount: number, toAmount: number, d: number, rate?: number, note?: string) =>
    (await db.cashTransfer.create({ data: { orgId, fromAccountId: from, toAccountId: to, amount, toAmount, date: day(d), rate: rate ?? null, rateBase: rate ? "USD" : null, note: note ?? null, createdById: ids.ACCOUNTANT } })).id;
  await tr(bankUzs, cashUzs, 10_000_000, 10_000_000, -6, undefined, "Kassaga naqd olish");
  const x1 = await tr(cashUsd, cashUzs, 500, 6_325_000, -2, 12_650, "Valyuta ayirboshlash");

  // "Oxirgi amallar" uchun namunaviy jurnal (menejer va buxgalter amallari)
  const log = (actorId: string, action: string, entity: string, entityId: string, hoursAgo: number) =>
    db.auditLog.create({ data: { orgId, actorId, action, entity, entityId, at: new Date(Date.now() - hoursAgo * 3_600_000) } });
  await log(by, "trip.create", "Trip", tE, 2);
  await log(by, "payment.create", "Payment", p5, 20);
  await log(by, "trip.create", "Trip", tC, 30);
  await log(by, "payment.create", "Payment", p2, 70);
  await log(by, "trip.create", "Trip", tB, 270);
  await log(by, "payment.create", "Payment", p1, 360);
  await log(ids.ACCOUNTANT, "transfer.create", "CashTransfer", x1, 40);
  await log(ids.ACCOUNTANT, "expense.create", "Expense", e2, 68);
  await log(ids.ACCOUNTANT, "expense.create", "Expense", e1, 285);

  console.log(`Demo tashkilot tayyor: ${ORG_NAME}. Hisoblar: ${USERS.map((u) => u.phone).join(", ")}`);
}

main().finally(() => db.$disconnect());
