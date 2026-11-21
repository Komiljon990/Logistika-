"use client";

import { useMemo, useState } from "react";
import { formatNumber, rateDigits } from "@/lib/currency-core";

const W = 640;
const H = 220;
const PAD = { l: 64, r: 16, t: 16, b: 28 };

function ddmm(day: string) {
  return `${day.slice(8, 10)}.${day.slice(5, 7)}`;
}

/** Oxirgi 30 kunlik kurs dinamikasi: bitta chiziq (tanlangan valyuta), kesishma chiziq va oynacha bilan. */
export function RateChart({ days, series, codes, labels }: {
  days: string[];
  series: Record<string, (number | null)[]>;
  codes: string[];
  labels: { title: string; currency: string; noData: string; table: string };
}) {
  const [code, setCode] = useState(codes[0] ?? "USD");
  const [hover, setHover] = useState<number | null>(null);
  const values = series[code] ?? [];

  const geo = useMemo(() => {
    const pts = values.map((v, i) => (v == null ? null : { i, v }));
    const known = pts.filter((p): p is { i: number; v: number } => p !== null);
    if (known.length < 2) return null;
    let min = Math.min(...known.map((p) => p.v));
    let max = Math.max(...known.map((p) => p.v));
    if (max - min < 1e-9) { min -= 1; max += 1; }
    const padY = (max - min) * 0.1;
    min -= padY; max += padY;
    const x = (i: number) => PAD.l + (i / Math.max(1, days.length - 1)) * (W - PAD.l - PAD.r);
    const y = (v: number) => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b);
    let d = "";
    let pen = false;
    for (const p of pts) {
      if (!p) { pen = false; continue; }
      d += `${pen ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`;
      pen = true;
    }
    const ticks = [0, 1, 2, 3].map((k) => min + ((max - min) * k) / 3);
    return { d, x, y, ticks, digits: rateDigits(max) };
  }, [values, days.length]);

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const rel = ((e.clientX - box.left) / box.width) * (W - PAD.l - PAD.r);
    const i = Math.round((rel / (W - PAD.l - PAD.r)) * (days.length - 1));
    setHover(Math.max(0, Math.min(days.length - 1, i)));
  };

  const hv = hover != null ? values[hover] : null;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-semibold">{labels.title}</h3>
        <span className="flex-1" />
        <label className="flex items-center gap-2 text-sm text-muted">
          {labels.currency}
          <select value={code} onChange={(e) => { setCode(e.target.value); setHover(null); }} className="input w-auto">
            {codes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>
      {!geo ? (
        <p className="text-sm text-muted">{labels.noData}</p>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`${labels.title}: ${code}`}>
            {geo.ticks.map((tv, k) => (
              <g key={k}>
                <line x1={PAD.l} x2={W - PAD.r} y1={geo.y(tv)} y2={geo.y(tv)} stroke="var(--color-line)" strokeWidth={1} />
                <text x={PAD.l - 8} y={geo.y(tv)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--color-muted)">
                  {formatNumber(tv, geo.digits)}
                </text>
              </g>
            ))}
            {[0, Math.floor((days.length - 1) / 2), days.length - 1].map((i) => (
              <text key={i} x={geo.x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === days.length - 1 ? "end" : "middle"} fontSize={11} fill="var(--color-muted)">
                {ddmm(days[i])}
              </text>
            ))}
            <path d={geo.d} fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {hover != null && hv != null && (
              <g>
                <line x1={geo.x(hover)} x2={geo.x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="var(--color-muted)" strokeWidth={1} strokeDasharray="3 3" />
                <circle cx={geo.x(hover)} cy={geo.y(hv)} r={5} fill="var(--color-accent)" stroke="var(--color-paper)" strokeWidth={2} />
              </g>
            )}
            <rect
              x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} fill="transparent"
              onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}
            />
          </svg>
          {hover != null && hv != null && (
            <div
              className="pointer-events-none absolute top-0 rounded-md border border-line bg-paper px-2 py-1 text-xs shadow-sm"
              style={{ left: `${(geo.x(hover) / W) * 100}%`, transform: geo.x(hover) > W * 0.7 ? "translateX(-105%)" : "translateX(8px)" }}
            >
              <div className="text-muted">{days[hover].split("-").reverse().join(".")}</div>
              <div className="font-semibold tabular-nums">1 {code} = {formatNumber(hv, rateDigits(hv))} so'm</div>
            </div>
          )}
        </div>
      )}
      {geo && (
        <details className="text-sm">
          <summary className="cursor-pointer text-accent">{labels.table}</summary>
          <div className="mt-2 max-h-60 overflow-y-auto">
            <table className="w-full text-sm">
              <tbody>
                {days.map((d, i) => (
                  <tr key={d} className="border-t border-line">
                    <td className="py-1 pr-3 tabular-nums">{d.split("-").reverse().join(".")}</td>
                    <td className="py-1 text-right tabular-nums">{values[i] != null ? formatNumber(values[i]!, rateDigits(values[i]!)) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
