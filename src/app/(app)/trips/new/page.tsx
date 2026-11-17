import Link from "next/link";
import { getDict, getT } from "@/i18n";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/session";
import { orgForWrite } from "@/lib/scope";
import { activeCurrencies } from "@/lib/org-currency";
import { loadedVehicleIds, routePlaces } from "@/lib/trips";
import { tashkentToday } from "@/lib/docs";
import { TripForm } from "../forms";

/** Yangi tashish: ro'yxatda faqat bo'sh (yuki yo'q) transport. Qo'shimcha yuk — tashish kartochkasidan. */
export default async function NewTripPage() {
  const user = await requireSection("trips", "EDIT");
  const orgId = orgForWrite(user);
  const [t, d] = [await getT(), await getDict()];
  const busy = await loadedVehicleIds(orgId);
  const [vehicles, drivers, clients, currencies, places] = await Promise.all([
    db.vehicle.findMany({
      where: { orgId, status: "ACTIVE", type: { in: ["TRACTOR", "TRAILER"] } },
      orderBy: { plate: "asc" },
      select: { id: true, plate: true, model: true, type: true, pairTrailerId: true, pairDriverId: true },
    }),
    db.driver.findMany({ where: { orgId, status: "ACTIVE" }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
    db.client.findMany({ where: { orgId, status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    activeCurrencies(orgId),
    routePlaces(orgId),
  ]);
  const free = vehicles.filter((v) => !busy.has(v.id));
  const trailers = free.filter((v) => v.type === "TRAILER");
  const trailerIds = new Set(trailers.map((x) => x.id));
  const driverIds = new Set(drivers.map((x) => x.id));
  const tractors = free
    .filter((v) => v.type === "TRACTOR")
    .map((v) => ({
      id: v.id,
      label: v.model ? `${v.plate} · ${v.model}` : v.plate,
      // Juftlikdagi prisept band bo'lsa, avtomatik tanlanmaydi.
      pairTrailerId: v.pairTrailerId && trailerIds.has(v.pairTrailerId) ? v.pairTrailerId : "",
      pairDriverId: v.pairDriverId && driverIds.has(v.pairDriverId) ? v.pairDriverId : "",
    }));
  const busyCount = vehicles.filter((v) => v.type === "TRACTOR" && busy.has(v.id)).length;

  return (
    <div className="grid gap-5">
      <Link href="/trips" className="text-sm text-accent hover:underline">← {t("trip.title")}</Link>
      <h1 className="text-2xl font-bold">{t("trip.new")}</h1>
      <p className="text-sm text-muted">{t("trip.newHint")}{busyCount > 0 && ` ${t("trip.busyCount")}: ${busyCount}.`}</p>
      {tractors.length === 0 ? (
        <p className="card px-4 py-6 text-sm text-muted">{t("trip.noFreeTractor")}</p>
      ) : (
        <TripForm
          d={d}
          tractors={tractors}
          trailers={trailers.map((x) => ({ id: x.id, label: x.plate }))}
          drivers={drivers.map((x) => ({ id: x.id, label: x.fullName }))}
          clients={clients.map((x) => ({ id: x.id, label: x.name }))}
          currencies={currencies}
          today={tashkentToday().toISOString().slice(0, 10)}
          places={places}
        />
      )}
    </div>
  );
}
