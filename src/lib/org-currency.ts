// "server-only" import qilinmaydi (21.11.2026): Telegram botdagi ovozli kiritish ham valyutalarni tekshiradi.
import { db } from "./db";
import { BASE, DEFAULT_CURRENCIES } from "./currency-core";

/**
 * Tashkilotning faol valyutalari. Ro'yxati hali yo'q (oldin yaratilgan) tashkilotga standart ro'yxat qo'yiladi.
 * Tashkilotga bog'lanmagan foydalanuvchilar (buxgalter, Super Admin) uchun standart ro'yxat.
 */
export async function activeCurrencies(orgId: string | null): Promise<string[]> {
  if (!orgId) return [...DEFAULT_CURRENCIES];
  await seedOrgCurrencies(orgId);
  const rows = await db.orgCurrency.findMany({ where: { orgId, active: true }, orderBy: { createdAt: "asc" }, select: { code: true } });
  const codes = rows.map((r) => r.code);
  return [BASE, ...codes.filter((c) => c !== BASE)];
}

export async function seedOrgCurrencies(orgId: string) {
  const count = await db.orgCurrency.count({ where: { orgId } });
  if (count > 0) return;
  await db.orgCurrency.createMany({
    data: DEFAULT_CURRENCIES.map((code) => ({ orgId, code })),
    skipDuplicates: true,
  });
}
