"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { LOC_COLORS as COLORS, type LocState } from "@/lib/location-core";

export type MapDriver = {
  id: string;
  name: string;
  plate: string | null;
  trip: string | null;
  lat: number | null;
  lng: number | null;
  time: string | null;
  state: LocState;
};

type Labels = Record<LocState, string> & { time: string; google: string };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Xarita (Leaflet + OpenStreetMap). Har daqiqada sahifa ma'lumoti yangilanadi (router.refresh) — xarita
 * qayta yaratilmaydi, faqat belgilar almashadi; foydalanuvchi surgan/kattalashtirgan holat saqlanadi.
 */
export function MapView({ drivers, track, labels }: { drivers: MapDriver[]; track: [number, number][]; labels: Labels }) {
  const box = useRef<HTMLDivElement>(null);
  const state = useRef<{ map?: import("leaflet").Map; layer?: import("leaflet").LayerGroup; fitted?: boolean }>({});
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(id);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !box.current) return;
      const s = state.current;
      if (!s.map) {
        s.map = L.map(box.current, { center: [41.3, 69.25], zoom: 5, worldCopyJump: true });
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(s.map);
        s.layer = L.layerGroup().addTo(s.map);
      }
      s.layer!.clearLayers();
      const pts: [number, number][] = [];
      if (track.length > 1) {
        L.polyline(track, { color: "#2563eb", weight: 4, opacity: 0.7 }).addTo(s.layer!);
        pts.push(...track);
      }
      for (const d of drivers) {
        if (d.lat == null || d.lng == null) continue;
        pts.push([d.lat, d.lng]);
        const m = L.circleMarker([d.lat, d.lng], { radius: 9, color: "#fff", weight: 2, fillColor: COLORS[d.state], fillOpacity: 1 }).addTo(s.layer!);
        m.bindTooltip(esc(d.plate ?? d.name), { permanent: true, direction: "top", offset: [0, -8] });
        const g = `https://www.google.com/maps?q=${d.lat},${d.lng}`;
        m.bindPopup(
          `<b>${esc(d.name)}</b>${d.plate ? `<br>🚛 ${esc(d.plate)}` : ""}${d.trip ? `<br>${esc(d.trip)}` : ""}` +
          `<br>${esc(labels[d.state])}${d.time ? ` · ${esc(labels.time)}: ${esc(d.time)}` : ""}` +
          `<br><a href="${g}" target="_blank" rel="noopener">${esc(labels.google)}</a>`,
        );
      }
      if (!s.fitted && pts.length) {
        s.fitted = true;
        if (pts.length === 1) s.map.setView(pts[0], 11);
        else s.map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 13 });
      }
    })();
    return () => { cancelled = true; };
  }, [drivers, track, labels]);

  useEffect(() => () => { state.current.map?.remove(); state.current = {}; }, []);

  return <div ref={box} className="card relative z-0 h-[60vh] min-h-80 w-full overflow-hidden" />;
}
