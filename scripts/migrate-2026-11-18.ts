/**
 * Bir martalik ma'lumot moslashtirish (18.11.2026):
 * 1) "O'zbekistonga kirdi" bosqichi olib tashlandi — yuk tushirilgan, lekin shu bosqichni kutib ochiq qolgan
 *    tashishlar yakunlanadi.
 * 2) Eski manzillar "Shahar (Davlat)" ko'rinishiga keltiriladi (ma'lumotnomadagi shaharlar).
 * Ishga tushirish: npx tsx scripts/migrate-2026-11-18.ts   (qayta ishga tushirish xavfsiz)
 */
import { PrismaClient } from "@prisma/client";
import { formatPlace } from "../src/lib/places-core";

const db = new PrismaClient();

async function main() {
  const done = await db.trip.updateMany({ where: { status: "ACTIVE", events: { some: { type: "UNLOADED" } } }, data: { status: "COMPLETED" } });
  console.log(`Yakunlangan tashishlar: ${done.count}`);

  const trips = await db.trip.findMany({ select: { id: true, routeFrom: true, routeTo: true } });
  let changed = 0;
  for (const t of trips) {
    const from = formatPlace(t.routeFrom).slice(0, 200);
    const to = formatPlace(t.routeTo).slice(0, 200);
    if (from !== t.routeFrom || to !== t.routeTo) {
      await db.trip.update({ where: { id: t.id }, data: { routeFrom: from, routeTo: to } });
      changed++;
    }
  }
  console.log(`Manzili moslashtirilgan tashishlar: ${changed} / ${trips.length}`);
}

main().finally(() => db.$disconnect());
