import "server-only";
import { db } from "./db";
import { parseCbu, type CbuRow, type RateMap } from "./currency-core";

const CBU_URL = (day: string) => `https://cbu.uz/uz/arkhiv-kursov-valyut/json/all/${day}/`;

/** Markaziy bankdan bir kunlik kurslar. Tarmoq xatosida null (sahifa kurssiz ochilaveradi). */
async function fetchCbuDay(day: string): Promise<CbuRow[] | null> {
  try {
    const res = await fetch(CBU_URL(day), { signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!res.ok) return null;
    const rows = parseCbu(await res.json());
    return rows.length ? rows : null;
  } catch {
    return null;
  }
}

/**
 * Berilgan kunlar uchun kurslar bazada bo'lishini ta'minlaydi: yo'qlarini Markaziy bankdan olib saqlaydi.
 * O'tgan kunlarning kursi o'zgarmaydi, shuning uchun har kun faqat bir marta olinadi.
 * Kelajakdagi kunlar so'ralmaydi.
 */
export async function ensureRates(days: string[], today: string): Promise<void> {
  const wanted = [...new Set(days)].filter((d) => d <= today);
  if (!wanted.length) return;
  const have = await db.exchangeRate.findMany({
    where: { code: "USD", date: { in: wanted.map((d) => new Date(`${d}T00:00:00Z`)) } },
    select: { date: true },
  });
  const haveSet = new Set(have.map((h) => h.date.toISOString().slice(0, 10)));
  const missing = wanted.filter((d) => !haveSet.has(d));
  for (let i = 0; i < missing.length; i += 6) {
    const batch = missing.slice(i, i + 6);
    const results = await Promise.all(batch.map(async (d) => [d, await fetchCbuDay(d)] as const));
    const data = results.flatMap(([d, rows]) =>
      (rows ?? []).map((r) => ({ date: new Date(`${d}T00:00:00Z`), code: r.code, rate: r.rate, name: r.name })),
    );
    if (data.length) await db.exchangeRate.createMany({ data, skipDuplicates: true });
  }
}

/** Bir kunlik kurslar: { USD: 11964.27, ... }. UZS qo'shilmaydi (u doim 1). */
export async function rateMap(day: string): Promise<RateMap> {
  const rows = await db.exchangeRate.findMany({ where: { date: new Date(`${day}T00:00:00Z`) }, select: { code: true, rate: true } });
  return Object.fromEntries(rows.map((r) => [r.code, Number(r.rate)]));
}

/** Kunlar bo'yicha kurslar seriyasi (grafik uchun). */
export async function rateSeries(codes: string[], days: string[]): Promise<Record<string, (number | null)[]>> {
  const rows = await db.exchangeRate.findMany({
    where: { code: { in: codes }, date: { in: days.map((d) => new Date(`${d}T00:00:00Z`)) } },
    select: { code: true, date: true, rate: true },
  });
  const byKey = new Map(rows.map((r) => [`${r.code}|${r.date.toISOString().slice(0, 10)}`, Number(r.rate)]));
  return Object.fromEntries(codes.map((c) => [c, days.map((d) => byKey.get(`${c}|${d}`) ?? null)]));
}

/** Markaziy bank ro'yxatidagi barcha valyutalar (oxirgi saqlangan kun bo'yicha) — rahbar shulardan qo'shadi. */
export async function knownCurrencies(): Promise<{ code: string; name: string | null }[]> {
  const last = await db.exchangeRate.findFirst({ orderBy: { date: "desc" }, select: { date: true } });
  if (!last) return [];
  return db.exchangeRate.findMany({ where: { date: last.date }, orderBy: { code: "asc" }, select: { code: true, name: true } });
}
