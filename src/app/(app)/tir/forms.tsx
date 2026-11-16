"use client";

import { useActionState, useState } from "react";
import type { Dict } from "@/i18n";
import type { FormState } from "@/lib/form";
import { cancelRejectedIssue, deletePermit, issuePermit, lostPermit, receivePermits, returnPermit, surrenderPermit } from "./actions";

function Msg({ state, d, ok }: { state: FormState; d: Dict; ok?: string }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
        {d[state.error]}{state.values?.dup ? `: ${state.values.dup}` : ""}
      </p>
    );
  }
  if (state.ok && ok) return <p role="status" className="text-sm text-accent">{ok}</p>;
  return null;
}

/** Kirim oynasi: odatda yopiq; "+ Kirim qilish" ochadi, "Yopish" yopadi. */
export function ReceivePanel({ d, today, title, heading, journal }: {
  d: Dict; today: string; title: string; heading: React.ReactNode; journal: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {heading}
        <span className="flex-1" />
        <button type="button" className="btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>+ {d["tir.receive"]}</button>
        {journal}
      </div>
      {open && (
        <section className="card grid gap-3 border-2 border-accent p-5">
          <div className="flex items-start gap-3">
            <h2 className="flex-1 text-lg font-semibold">+ {title}</h2>
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)} aria-label={d["common.close"]}>✕ {d["common.close"]}</button>
          </div>
          <ReceiveForm d={d} today={today} />
        </section>
      )}
    </div>
  );
}

export function ReceiveForm({ d, today }: { d: Dict; today: string }) {
  const [type, setType] = useState<"TIR" | "DAZVOL">("TIR");
  const [saved, setSaved] = useState(0);
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await receivePermits(prev, fd);
    if (r.ok) setSaved((n) => n + 1);
    return r;
  }, {});
  const v = state.values ?? {};
  return (
    <form key={saved} action={action} className="grid gap-3">
      <fieldset>
        <legend className="label">{d["tir.type"]}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["TIR", "DAZVOL"] as const).map((k) => (
            <label key={k} className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm ${type === k ? "border-2 border-accent font-semibold" : "border border-line"}`}>
              <input type="radio" name="type" value={k} checked={type === k} onChange={() => setType(k)} /> {d[`tir.t.${k}`]}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="p-numbers" className="label">{d["tir.numbers"]}</label>
        <textarea id="p-numbers" name="numbers" required rows={2} defaultValue={v.numbers} placeholder="XA12345678, XA12345679 / 1001-1010" className="input font-mono" />
        <p className="mt-1 text-xs text-muted">{d["tir.numbersHint"]}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {type === "DAZVOL" && (
          <div>
            <label htmlFor="p-country" className="label">{d["tir.country"]}</label>
            <input id="p-country" name="country" required maxLength={100} defaultValue={v.country} placeholder={d["tir.countryPh"]} className="input" />
          </div>
        )}
        <div>
          <label htmlFor="p-kind" className="label">{type === "DAZVOL" ? d["tir.kindDazvol"] : d["tir.kindTir"]}</label>
          <input id="p-kind" name="kind" maxLength={100} defaultValue={v.kind} placeholder={type === "DAZVOL" ? d["tir.kindDazvolPh"] : d["tir.kindTirPh"]} className="input" />
        </div>
        <div className={type === "DAZVOL" ? "sm:col-span-2" : ""}>
          <label htmlFor="p-issuer" className="label">{d["tir.issuer"]}</label>
          <input id="p-issuer" name="issuer" maxLength={200} defaultValue={v.issuer} placeholder={d["tir.issuerPh"]} className="input" />
        </div>
        <div>
          <label htmlFor="p-recv" className="label">{d["tir.receivedAt"]}</label>
          <input id="p-recv" name="receivedAt" type="date" required max={today} defaultValue={v.receivedAt ?? today} className="input" />
        </div>
        <div>
          <label htmlFor="p-valid" className="label">{d["tir.validUntil"]}</label>
          <input id="p-valid" name="validUntil" type="date" required defaultValue={v.validUntil} className="input" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="p-note" className="label">{d["common.note"]}</label>
          <input id="p-note" name="note" maxLength={300} defaultValue={v.note} className="input" />
        </div>
      </div>
      <button className="btn min-h-11" disabled={pending}>{d["tir.receive"]}</button>
      <Msg state={state} d={d} ok={d["tir.received"]} />
    </form>
  );
}

type Opt = { id: string; label: string };

/** Bitta blanka bo'yicha amallar (holatiga qarab). */
export function PermitActions({ d, id, status, today, vehicles, drivers, pair }: {
  d: Dict; id: string; status: string; today: string; vehicles: Opt[]; drivers: Opt[];
  /** Tyagach → standart haydovchi (tanlanganda avtomatik qo'yiladi). */
  pair: Record<string, string>;
}) {
  return (
    <div className="flex shrink-0 flex-nowrap items-center gap-1.5">
      {status === "STOCK" && <Pop d={d} short={d["tir.issueShort"]} label={d["tir.issue"]} primary><IssueForm d={d} id={id} today={today} vehicles={vehicles} drivers={drivers} pair={pair} /></Pop>}
      {status === "ISSUED" && <Pop d={d} short={d["tir.returnShort"]} label={d["tir.return"]} primary><SimpleForm d={d} today={today} action={returnPermit.bind(null, id)} submit={d["tir.return"]} used /></Pop>}
      {(status === "USED" || status === "STOCK") && (
        <Pop d={d} short={d["tir.surrenderShort"]} label={d["tir.surrender"]} primary={status === "USED"}><SimpleForm d={d} today={today} action={surrenderPermit.bind(null, id)} submit={d["tir.surrender"]} /></Pop>
      )}
      {status !== "SURRENDERED" && status !== "LOST" && (
        <Pop d={d} short={d["tir.lostShort"]} label={d["tir.lost"]} danger><SimpleForm d={d} today={today} action={lostPermit.bind(null, id)} submit={d["tir.lost"]} danger /></Pop>
      )}
    </div>
  );
}

const CHIP = "inline-flex min-h-8 cursor-pointer list-none items-center whitespace-nowrap rounded-lg border px-2.5 text-xs font-semibold";

function Pop({ d, label, short, primary, danger, children }: {
  d: Dict; label: string; short: string; primary?: boolean; danger?: boolean; children: React.ReactNode;
}) {
  const tone = primary ? "border-accent bg-accent text-on-accent" : danger ? "border-line text-bad hover:border-bad" : "border-line text-ink hover:border-accent";
  return (
    <details className="relative">
      <summary title={label} className={`${CHIP} ${tone}`}>{short}</summary>
      <div className="card absolute right-0 z-20 mt-2 grid w-80 max-w-[85vw] gap-2 p-4 shadow-lg">
        <div className="flex items-center gap-2">
          <span className="flex-1 text-sm font-semibold">{label}</span>
          <button
            type="button"
            className="text-sm text-muted hover:text-ink"
            aria-label={d["common.close"]}
            onClick={(e) => { const det = e.currentTarget.closest("details"); if (det) det.open = false; }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </details>
  );
}

function IssueForm({ d, id, today, vehicles, drivers, pair }: { d: Dict; id: string; today: string; vehicles: Opt[]; drivers: Opt[]; pair: Record<string, string> }) {
  const [state, action, pending] = useActionState(issuePermit.bind(null, id), {});
  const [driverId, setDriverId] = useState("");
  return (
    <form action={action} className="grid gap-3">
      <div>
        <label htmlFor={`v-${id}`} className="label">{d["trip.tractor"]}</label>
        <select id={`v-${id}`} name="vehicleId" required defaultValue="" onChange={(e) => pair[e.target.value] && setDriverId(pair[e.target.value])} className="input">
          <option value="" disabled>—</option>
          {vehicles.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={`dr-${id}`} className="label">{d["trip.driver"]}</label>
        <select id={`dr-${id}`} name="driverId" required value={driverId} onChange={(e) => setDriverId(e.target.value)} className="input">
          <option value="" disabled>—</option>
          {drivers.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={`di-${id}`} className="label">{d["pay.date"]}</label>
        <input id={`di-${id}`} name="date" type="date" required max={today} defaultValue={today} className="input" />
      </div>
      <input name="note" maxLength={300} placeholder={d["common.note"]} aria-label={d["common.note"]} className="input" />
      <button className="btn" disabled={pending}>{d["tir.issue"]}</button>
      <Msg state={state} d={d} />
    </form>
  );
}

function SimpleForm({ d, today, action: act, submit, used, danger }: {
  d: Dict; today: string; action: (prev: FormState, fd: FormData) => Promise<FormState>; submit: string; used?: boolean; danger?: boolean;
}) {
  const [state, action, pending] = useActionState(act, {});
  return (
    <form action={action} className="grid gap-3">
      <div>
        <label className="label">{d["pay.date"]}
          <input name="date" type="date" required max={today} defaultValue={today} className="input mt-1" />
        </label>
      </div>
      {used && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="used" defaultChecked className="mt-1" />
          <span>{d["tir.used"]}<span className="block text-xs text-muted">{d["tir.usedHint"]}</span></span>
        </label>
      )}
      <input name="note" maxLength={300} placeholder={d["common.note"]} aria-label={d["common.note"]} className="input" />
      <button className={danger ? "btn-danger" : "btn"} disabled={pending}>{submit}</button>
      <Msg state={state} d={d} />
    </form>
  );
}

/** Haydovchi bot orqali "olmadim" degan berishni bekor qilish. */
export function CancelIssueButton({ d, id }: { d: Dict; id: string }) {
  const [state, action, pending] = useActionState(async () => cancelRejectedIssue(id), {} as FormState);
  return (
    <form action={action} onSubmit={(e) => { if (!window.confirm(d["tir.cancelIssueConfirm"])) e.preventDefault(); }} className="flex flex-wrap items-center gap-2">
      <button className="btn-danger" disabled={pending}>{d["tir.cancelIssue"]}</button>
      <Msg state={state} d={d} />
    </form>
  );
}

/** Haydovchining bot orqali javobi. */
export function AckBadge({ d, ack, linked }: { d: Dict; ack: string | null; linked: boolean }) {
  const map: Record<string, [string, string]> = {
    PENDING: ["border-warn text-warn", d["tir.ack.PENDING"]],
    CONFIRMED: ["border-accent text-accent", d["tir.ack.CONFIRMED"]],
    REJECTED: ["border-bad bg-bad-soft text-bad font-semibold", d["tir.ack.REJECTED"]],
  };
  const [cls, label] = ack ? map[ack] : ["border-line text-muted", linked ? d["tir.ack.notSent"] : d["tir.ack.noBot"]];
  return <span className={`rounded-full border px-2 py-0.5 text-xs ${cls}`}>{label}</span>;
}

export function DeletePermitButton({ d, id }: { d: Dict; id: string }) {
  const [state, action, pending] = useActionState(async () => deletePermit(id), {} as FormState);
  return (
    <form action={action} onSubmit={(e) => { if (!window.confirm(d["tir.deleteConfirm"])) e.preventDefault(); }} className="flex flex-wrap items-center gap-2">
      <button className="btn-ghost text-bad" disabled={pending}>{d["common.delete"]}</button>
      <Msg state={state} d={d} />
    </form>
  );
}
