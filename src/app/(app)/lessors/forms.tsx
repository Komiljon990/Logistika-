"use client";

import { useActionState, useState } from "react";
import type { Dict } from "@/i18n";
import type { FormState } from "@/lib/form";
import { CHARGE_TYPES } from "@/lib/lessors-core";
import { addDriverEntry, attachVehicle, bulkMembership, cancelDriverEntry, createLessor, detachVehicle } from "./actions";

type Side = "LESSOR" | "STAFF";

function Msg({ state, d, ok }: { state: FormState; d: Dict; ok?: string }) {
  if (state.error) return <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{d[state.error]}</p>;
  if (state.ok && ok) return <p role="status" className="text-sm text-accent">{ok}</p>;
  return null;
}

/** Yangi ijarachi: F.I.Sh. va telefon — "o'z transportida" toifali haydovchi sifatida yaratiladi. */
export function NewLessorForm({ d }: { d: Dict }) {
  const [state, action, pending] = useActionState(createLessor, {} as FormState);
  const v = state.values;
  return (
    <form key={JSON.stringify(v ?? null)} action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor="l-name" className="label">{d["drv.fullName"]}</label>
        <input id="l-name" name="fullName" required maxLength={200} defaultValue={v?.fullName} className="input" />
      </div>
      <div>
        <label htmlFor="l-phone" className="label">{d["user.phone"]}</label>
        <input id="l-phone" name="phone" type="tel" defaultValue={v?.phone} placeholder="+998 90 123 45 67" className="input" />
      </div>
      <div>
        <label htmlFor="l-note" className="label">{d["common.note"]}</label>
        <input id="l-note" name="note" maxLength={300} defaultValue={v?.note} className="input" />
      </div>
      <p className="text-xs text-muted sm:col-span-2">{d["lessor.newHint"]}</p>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button className="btn" disabled={pending}>{d["common.add"]}</button>
        <Msg state={state} d={d} />
      </div>
    </form>
  );
}

type Opt = { id: string; label: string };

export function AttachVehicleForm({ d, driverId, vehicles }: { d: Dict; driverId: string; vehicles: Opt[] }) {
  const [state, action, pending] = useActionState(attachVehicle.bind(null, driverId), {} as FormState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <select name="vehicleId" required defaultValue="" aria-label={d["lessor.vehicle"]} className="input w-auto min-w-0 flex-1 basis-56">
        <option value="" disabled>{d["lessor.pickVehicle"]}</option>
        {vehicles.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
      </select>
      <button className="btn-ghost" disabled={pending}>+ {d["lessor.attach"]}</button>
      <Msg state={state} d={d} />
    </form>
  );
}

export function DetachVehicleButton({ d, vehicleId }: { d: Dict; vehicleId: string }) {
  const [, action, pending] = useActionState(async () => { await detachVehicle(vehicleId); return {}; }, {});
  return (
    <form action={action} onSubmit={(e) => { if (!window.confirm(d["lessor.detachConfirm"])) e.preventDefault(); }} className="inline">
      <button className="text-xs text-muted hover:text-bad hover:underline" disabled={pending}>{d["lessor.detach"]}</button>
    </form>
  );
}

type AccountOpt = { id: string; label: string; currency: string };

/** "+ Hisob qo'shish" va "+ To'lov" tugmalari va ularning oynalari (ijarachi va xodim haydovchi uchun). */
export function LedgerButtons({ d, driverId, side, currencies, accounts, vehicles, trips, months, today }: {
  d: Dict; driverId: string; side: Side; currencies: string[]; accounts: AccountOpt[]; vehicles: Opt[]; trips: Opt[]; months: string[]; today: string;
}) {
  const [open, setOpen] = useState<"CHARGE" | "PAYMENT" | null>(null);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={open === "CHARGE" ? "btn" : "btn-ghost"} onClick={() => setOpen(open === "CHARGE" ? null : "CHARGE")}>+ {d["lessor.addCharge"]}</button>
        <button type="button" className={open === "PAYMENT" ? "btn" : "btn-ghost"} onClick={() => setOpen(open === "PAYMENT" ? null : "PAYMENT")}>+ {d["lessor.addPayment"]}</button>
      </div>
      {open && (
        <EntryForm
          key={open} d={d} driverId={driverId} side={side} kind={open} currencies={currencies} accounts={open === "PAYMENT" ? accounts : []}
          vehicles={vehicles} trips={trips} months={months} today={today} onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

const monthLabel = (m: string) => `${m.slice(5, 7)}.${m.slice(0, 4)}`;

function EntryForm({ d, driverId, side, kind, currencies, accounts, vehicles, trips, months, today, onClose }: {
  d: Dict; driverId: string; side: Side; kind: "CHARGE" | "PAYMENT"; currencies: string[]; accounts: AccountOpt[];
  vehicles: Opt[]; trips: Opt[]; months: string[]; today: string; onClose: () => void;
}) {
  const types = CHARGE_TYPES[side];
  const [saved, setSaved] = useState(0);
  const [type, setType] = useState<string>(types[0]);
  const [accountId, setAccountId] = useState(accounts.length === 1 ? accounts[0].id : "");
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await addDriverEntry(driverId, side, kind, prev, fd);
    if (r.ok) setSaved((n) => n + 1);
    return r;
  }, {} as FormState);
  const cur = accounts.find((a) => a.id === accountId)?.currency;
  const v = state.values;
  const payTitle = side === "LESSOR" ? d["lessor.paymentTitle"] : d["ledger.staffPaymentTitle"];
  const payHint = side === "LESSOR" ? d["lessor.paymentHint"] : d["ledger.staffPaymentHint"];
  return (
    <form key={saved} action={action} className={`card grid gap-3 border-2 p-4 sm:grid-cols-2 ${kind === "CHARGE" ? "border-warn" : "border-accent"}`}>
      <div className="flex items-center gap-2 sm:col-span-2">
        <h3 className="flex-1 font-semibold">{kind === "CHARGE" ? d["lessor.chargeTitle"] : payTitle}</h3>
        <button type="button" className="btn-ghost" onClick={onClose}>✕ {d["common.close"]}</button>
      </div>
      <p className="text-xs text-muted sm:col-span-2">{kind === "CHARGE" ? (side === "LESSOR" ? d["lessor.chargeHint"] : d["ledger.staffChargeHint"]) : payHint}</p>
      {kind === "CHARGE" && (
        <fieldset className="sm:col-span-2">
          <legend className="label">{d["ledger.type"]}</legend>
          <div className="flex flex-wrap gap-2">
            {types.map((x) => (
              <label key={x} className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${type === x ? "border-2 border-accent bg-accent-soft font-semibold text-accent" : "border-line"}`}>
                <input type="radio" name="type" value={x} checked={type === x} onChange={() => setType(x)} className="sr-only" />
                {d[`ledger.t.${x}`]}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {kind === "CHARGE" && type === "MEMBERSHIP" && (
        <div>
          <label htmlFor="le-period" className="label">{d["ledger.period"]}</label>
          <select id="le-period" name="period" required defaultValue={v?.period ?? today.slice(0, 7)} className="input">
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </div>
      )}
      {kind === "CHARGE" && type === "TRIP" && (
        <div className="sm:col-span-2">
          <label htmlFor="le-trip" className="label">{d["ledger.trip"]}</label>
          <select id="le-trip" name="tripId" required defaultValue={v?.tripId ?? ""} className="input">
            <option value="" disabled>{trips.length ? d["ledger.pickTrip"] : d["ledger.noTrips"]}</option>
            {trips.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
      )}
      {kind === "PAYMENT" && accounts.length > 0 && (
        <div className="sm:col-span-2">
          <label htmlFor="le-acc" className="label">{side === "LESSOR" ? d["ledger.toAccount"] : d["cash.fromAccount"]}</label>
          <select id="le-acc" name="accountId" required value={accountId} onChange={(e) => setAccountId(e.target.value)} className="input">
            <option value="" disabled>{d["pay.pickAccount"]}</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>
      )}
      <div>
        <label htmlFor="le-amount" className="label">{d["cash.amount"]}{cur ? `, ${cur}` : ""}</label>
        <input id="le-amount" name="amount" required inputMode="decimal" defaultValue={v?.amount} className="input text-lg font-semibold tabular-nums" />
      </div>
      {!(kind === "PAYMENT" && accounts.length > 0) ? (
        <div>
          <label htmlFor="le-cur" className="label">{d["currency.code"]}</label>
          <select id="le-cur" name="currency" defaultValue={v?.currency ?? (currencies.includes("UZS") ? "UZS" : currencies[0])} className="input">
            {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      ) : (
        <input type="hidden" name="currency" value={cur ?? ""} />
      )}
      <div>
        <label htmlFor="le-date" className="label">{d["pay.date"]}</label>
        <input id="le-date" name="date" type="date" required max={today} defaultValue={v?.date ?? today} className="input" />
      </div>
      {vehicles.length > 0 && (
        <div>
          <label htmlFor="le-veh" className="label">{d["lessor.vehicle"]}</label>
          <select id="le-veh" name="vehicleId" defaultValue={v?.vehicleId ?? (vehicles.length === 1 ? vehicles[0].id : "")} className="input">
            <option value="">—</option>
            {vehicles.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </div>
      )}
      <div className="sm:col-span-2">
        <label htmlFor="le-note" className="label">{d["common.note"]}</label>
        <input id="le-note" name="note" maxLength={300} defaultValue={v?.note} className="input" />
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button className="btn" disabled={pending}>{d["common.save"]}</button>
        <Msg state={state} d={d} ok={d["common.saved"]} />
      </div>
    </form>
  );
}

export function CancelEntryButton({ d, id }: { d: Dict; id: string }) {
  const [, action, pending] = useActionState(async () => { await cancelDriverEntry(id); return {}; }, {});
  return (
    <form action={action} onSubmit={(e) => { if (!window.confirm(d["cash.deleteConfirm"])) e.preventDefault(); }} className="inline">
      <button className="text-sm text-muted hover:underline" disabled={pending}>{d["common.delete"]}</button>
    </form>
  );
}

/** Oylik a'zolik to'lovini barcha faol ijarachilarga birdaniga hisoblash (shu oy uchun hisoblanmaganlarga). */
export function BulkMembershipForm({ d, currencies, months, today }: { d: Dict; currencies: string[]; months: string[]; today: string }) {
  const [state, action, pending] = useActionState(bulkMembership, {} as FormState & { count?: number });
  const v = state.values;
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-4 sm:items-end">
      <div>
        <label htmlFor="bm-period" className="label">{d["ledger.period"]}</label>
        <select id="bm-period" name="period" defaultValue={v?.period ?? today.slice(0, 7)} className="input">
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="bm-amount" className="label">{d["cash.amount"]}</label>
        <input id="bm-amount" name="amount" required inputMode="decimal" defaultValue={v?.amount} className="input tabular-nums" />
      </div>
      <div>
        <label htmlFor="bm-cur" className="label">{d["currency.code"]}</label>
        <select id="bm-cur" name="currency" defaultValue={v?.currency ?? (currencies.includes("UZS") ? "UZS" : currencies[0])} className="input">
          {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <button className="btn" disabled={pending} onClick={(e) => { if (!window.confirm(d["lessor.bulkConfirm"])) e.preventDefault(); }}>{d["lessor.bulkRun"]}</button>
      <div className="sm:col-span-4">
        {state.error && <Msg state={state} d={d} />}
        {state.ok && <p role="status" className="text-sm text-accent">{d["lessor.bulkDone"].replace("{n}", String(state.count ?? 0))}</p>}
      </div>
    </form>
  );
}