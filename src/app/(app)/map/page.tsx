import Link from "next/link";
import { getT } from "@/i18n";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/session";
import { orgScope } from "@/lib/scope";
import { formatTashkent } from "@/lib/trips-core";
import { LOC_COLORS, locState } from "@/lib/location-core";
import { formatPhone } from "@/lib/phone";
import { MapView, type MapDriver } from "./MapView";

/**
 * Haydovchilar xaritasi (23.11.2026): joylashuv kuzatuvi yoqilgan haydovchilarning oxirgi joyi.
 * ?d=<haydovchi> — shu haydovchining oxirgi 24 soatdagi yo'li ham chiziladi. Faqat o'z tashkiloti (orgScope).
 */
export default async function MapPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const user = await requireSection("drivers");
  const sp = await searchParams;
  const t = await getT();
  const now = new Date();
  const rows = await db.driver.findMany({
    where: { ...orgScope(user), status: "ACTIVE", trackLocation: true },
    orderBy: { fullName: "asc" },
    select: {
      id: true, fullName: true, phone: true, lastLat: true, lastLng: true, lastLocAt: true, liveUntil: true, telegramChatId: true,
      pairedVehicles: { where: { status: "ACTIVE" }, select: { plate: true }, take: 1 },
      trips: {
        where: { status: "ACTIVE" }, orderBy: { loadDate: "asc" }, take: 1,
        select: { id: true, number: true, routeFrom: true, routeTo: true, tractor: { select: { plate: true } } },
      },
    },
  });
  const drivers: (MapDriver & { tripId?: string; phone: string | null; linked: boolean })[] = rows.map((r) => {
    const trip = r.trips[0];
    return {
      id: r.id,
      name: r.fullName,
      phone: r.phone,
      linked: !!r.telegramChatId,
      plate: trip?.tractor.plate ?? r.pairedVehicles[0]?.plate ?? null,
      trip: trip ? `TSH-${String(trip.number).padStart(4, "0")}: ${trip.routeFrom} → ${trip.routeTo}` : null,
      tripId: trip?.id,
      lat: r.lastLat,
      lng: r.lastLng,
      time: r.lastLocAt ? formatTashkent(r.lastLocAt) : null,
      state: locState(r, now),
    };
  });
  const focus = sp.d ? drivers.find((x) => x.id === sp.d) : undefined;
  const track = focus
    ? (await db.driverLocation.findMany({
        where: { ...orgScope(user), driverId: focus.id, at: { gte: new Date(now.getTime() - 86_400_000) } },
        orderBy: { at: "asc" },
        select: { lat: true, lng: true },
        take: 2000,
      })).map((p) => [p.lat, p.lng] as [number, number])
    : [];
  const labels = {
    LIVE: t("loc.state.LIVE"), STALE: t("loc.state.STALE"), STOPPED: t("loc.state.STOPPED"), NONE: t("loc.state.NONE"),
    time: t("loc.time"), google: t("loc.google"),
  };
  return (
    <div className="grid min-w-0 gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-2xl font-bold">{t("loc.mapTitle")}</h1>
        {focus && <Link href="/map" className="btn-ghost">{t("loc.showAll")}</Link>}
      </div>
      <p className="text-sm text-muted">{focus ? `${focus.name} — ${t("loc.track")}` : t("loc.mapHint")}</p>
      {drivers.length === 0 ? (
        <p className="card p-5 text-sm text-muted">{t("loc.empty")}</p>
      ) : (
        <>
          <MapView drivers={focus ? [focus] : drivers} track={track} labels={labels} />
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">{t("drv.fullName")}</th>
                  <th className="px-4 py-2 font-medium">{t("veh.title")}</th>
                  <th className="px-4 py-2 font-medium">{t("loc.trip")}</th>
                  <th className="px-4 py-2 font-medium">{t("loc.status")}</th>
                  <th className="px-4 py-2 font-medium">{t("loc.time")}</th>
                  <th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {drivers.map((x) => (
                  <tr key={x.id} className={`border-t border-line ${focus?.id === x.id ? "bg-accent-soft" : ""}`}>
                    <td className="min-w-36 px-4 py-2.5">
                      <Link href={`/drivers/${x.id}`} className="text-accent hover:underline">{x.name}</Link>
                      {x.phone && <span className="block whitespace-nowrap text-xs text-muted tabular-nums">{formatPhone(x.phone)}</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">{x.plate ?? "—"}</td>
                    <td className="min-w-44 px-4 py-2.5">{x.tripId ? <Link href={`/trips/${x.tripId}`} className="text-accent hover:underline">{x.trip}</Link> : "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className="whitespace-nowrap">
                        <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: LOC_COLORS[x.state] }} />
                        {labels[x.state]}
                      </span>
                      {!x.linked && <span className="block min-w-40 text-xs text-warn">{t("loc.needBot")}</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{x.time ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      {x.lat != null && focus?.id !== x.id && <Link href={`/map?d=${x.id}`} className="text-accent hover:underline">{t("loc.onMap")}</Link>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
