"use client";

import { useState } from "react";
import { crossRate, formatNumber, parseAmount, rateDigits, type RateMap } from "@/lib/currency-core";

function fmt(n: number | null, digits = 2) {
  return n == null ? "" : formatNumber(n, digits);
}

type Side = "a" | "b";

/**
 * Valyuta kalkulyatori: ikki valyuta tanlanadi, ular orasidagi MB kursi katakda chiqadi.
 * Kelishilgan kurs bo'lsa shu katakning o'zida o'zgartiriladi. Bir tomonga summa yozilsa, ikkinchisi o'zi hisoblanadi.
 */
export function Calculator({ codes, rates, rateDateLabel, labels }: {
  codes: string[];
  rates: RateMap;
  rateDateLabel: string;
  labels: { title: string; rate: string; cbu: string; manual: string; reset: string; swap: string; amount: string; noRate: string };
}) {
  const [a, setA] = useState(codes.includes("USD") ? "USD" : codes[0]);
  const [b, setB] = useState(codes.includes("UZS") ? "UZS" : codes[1] ?? codes[0]);
  const cbu = crossRate(rates, a, b);
  const [rateText, setRateText] = useState(fmt(cbu, cbu ? rateDigits(cbu) : 2));
  const [manual, setManual] = useState(false);
  const [amtA, setAmtA] = useState("1 000,00");
  const [amtB, setAmtB] = useState(() => fmt(cbu != null ? 1000 * cbu : null));
  const [last, setLast] = useState<Side>("a");

  const recompute = (rate: number | null, side: Side, value: string) => {
    const v = parseAmount(value);
    if (side === "a") setAmtB(rate != null && v != null ? fmt(v * rate) : "");
    else setAmtA(rate != null && v != null && rate !== 0 ? fmt(v / rate) : "");
  };

  const resetTo = (na: string, nb: string) => {
    const r = crossRate(rates, na, nb);
    setRateText(fmt(r, r ? rateDigits(r) : 2));
    setManual(false);
    recompute(r, last, last === "a" ? amtA : amtB);
  };

  const rateNow = parseAmount(rateText);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="font-semibold">{labels.title}</h3>
        <span className="text-xs text-muted">{rateDateLabel}</span>
      </div>

      {/* Har valyuta alohida qatorda: summa butun kenglikni egallaydi, katta sonlar ham sig'adi. */}
      <div className="grid gap-2">
        <div className="flex min-w-0 gap-2">
          <select aria-label={`${labels.amount} 1`} value={a} onChange={(e) => { setA(e.target.value); resetTo(e.target.value, b); }} className="input w-24 shrink-0">
            {codes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            aria-label={`${labels.amount} ${a}`} inputMode="decimal" value={amtA}
            onChange={(e) => { setAmtA(e.target.value); setLast("a"); recompute(rateNow, "a", e.target.value); }}
            className="input min-w-0 flex-1 text-right text-lg font-semibold tabular-nums"
          />
        </div>
        <button
          type="button" aria-label={labels.swap} title={labels.swap}
          onClick={() => {
            // Summalar o'rin almashadi; kurs teskarisiga aylanadi (kelishilgan kurs ham saqlanadi).
            const inv = rateNow ? 1 / rateNow : null;
            setA(b); setB(a); setAmtA(amtB); setAmtB(amtA); setLast(last === "a" ? "b" : "a");
            if (manual) setRateText(fmt(inv, inv ? rateDigits(inv) : 2));
            else { const r = crossRate(rates, b, a); setRateText(fmt(r, r ? rateDigits(r) : 2)); }
          }}
          className="grid size-11 place-items-center justify-self-center rounded-full border border-line text-lg hover:bg-accent-soft"
        >
          ⇅
        </button>
        <div className="flex min-w-0 gap-2">
          <select aria-label={`${labels.amount} 2`} value={b} onChange={(e) => { setB(e.target.value); resetTo(a, e.target.value); }} className="input w-24 shrink-0">
            {codes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            aria-label={`${labels.amount} ${b}`} inputMode="decimal" value={amtB}
            onChange={(e) => { setAmtB(e.target.value); setLast("b"); recompute(rateNow, "b", e.target.value); }}
            className="input min-w-0 flex-1 text-right text-lg font-semibold tabular-nums"
          />
        </div>
      </div>

      <div className={`grid gap-2 rounded-lg p-3 ${manual ? "bg-warn-soft" : "bg-accent-soft"}`}>
        <label className="flex flex-wrap items-center gap-2 text-sm">
          <span>{labels.rate}: 1 {a} =</span>
          <input
            aria-label={labels.rate} inputMode="decimal" value={rateText}
            onChange={(e) => {
              setRateText(e.target.value);
              setManual(true);
              recompute(parseAmount(e.target.value), last, last === "a" ? amtA : amtB);
            }}
            className="input min-w-0 max-w-52 flex-1 text-right font-semibold tabular-nums"
          />
          <span>{b}</span>
        </label>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {cbu == null ? (
            <span className="text-bad">{labels.noRate}</span>
          ) : manual ? (
            <>
              <span className="text-warn">{labels.manual}</span>
              <span className="text-muted">· {labels.cbu}: {fmt(cbu, rateDigits(cbu))}</span>
              <button type="button" onClick={() => resetTo(a, b)} className="min-h-8 text-accent hover:underline">{labels.reset}</button>
            </>
          ) : (
            <span className="text-muted">{labels.cbu}</span>
          )}
        </div>
      </div>
    </div>
  );
}
