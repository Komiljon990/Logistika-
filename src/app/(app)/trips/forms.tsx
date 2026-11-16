"use client";

import { useActionState, useState } from "react";
import type { TripEventType } from "@prisma/client";
import type { Dict } from "@/i18n";
import type { FormState } from "@/lib/form";
import { createTrip, addShipment, addTripEvent, cancelTrip, updateShipment, updateTrip } from "./actions";
import { createClient, updateClient } from "../clients/actions";

function Message({ state, d, okText }: { state: FormState; d: Dict; okText?: string }) {
  if (state.error) return <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{d[state.error]}</p>;
  if (state.ok) return <p className="text-sm text-accent">{okText ?? d["common.saved"]}</p>;
  return null;
}

function Field({ id, label, children, wide, hint }: { id: string; label: string; children: React.ReactNode; wide?: boolean; hint?: string }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <label htmlFor={id} className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

// ---------- Mijoz ----------

export type ClientValues = { id: string; name: string; inn: string; phone: string; address: string; note: string };

export function ClientForm({ d, client, readOnly = false }: { d: Dict; client?: ClientValues; readOnly?: boolean }) {
  const action = client ? updateClient.bind(null, client.id) : createClient;
  const [state, formAction, pending] = useActionState(action, {});
  const v = state.values;
  const val = (k: keyof ClientValues) => v?.[k] ?? client?.[k] ?? "";
  return (
    <form key={JSON.stringify(v ?? client ?? null)} action={formAction}>
      <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2">
        <Field id="c-name" label={d["client.name"]} wide>
          <input id="c-name" name="name" required defaultValue={val("name")} className="input" />
        </Field>
        <Field id="c-inn" label={d["org.inn"]}>
          <input id="c-inn" name="inn" inputMode="numeric" defaultValue={val("inn")} className="input" />
        </Field>
        <Field id="c-phone" label={d["org.phone"]}>
          <input id="c-phone" name="phone" type="tel" defaultValue={val("phone")} className="input" />
        </Field>
        <Field id="c-address" label={d["org.address"]} wide>
          <input id="c-address" name="address" defaultValue={val("address")} className="input" />
        </Field>
        <Field id="c-note" label={d["common.note"]} wide>
          <input id="c-note" name="note" defaultValue={val("note")} className="input" />
        </Field>
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button className="btn" disabled={pending}>{client ? d["common.save"] : d["common.add"]}</button>
            <Message state={state} d={d} />
          </div>
        )}
      </fieldset>
    </form>
  );
}

// ---------- Yuk qismi (mijoz, mas'ul shaxs, kelishuv, narx) ----------

type Option = { id: string; label: string };

function ShipmentFields({ d, clients, currencies, v, listOnly = false, noNewClient = false, idp = "s" }: {
  d: Dict; clients: Option[]; currencies: string[]; v?: Record<string, string>;
  /** "Faqat ro'yxat": narx, kelishuv va buxgalteriya narxi ko'rsatilmaydi, mas'ul shaxs ixtiyoriy. */
  listOnly?: boolean; noNewClient?: boolean; idp?: string;
}) {
  const [clientId, setClientId] = useState(v?.clientId ?? (clients.length ? "" : "new"));
  const [terms, setTerms] = useState(v?.terms ?? "CONTRACT");
  const [showAcc, setShowAcc] = useState(!!v?.accountingPrice);
  const id = (k: string) => `${idp}-${k}`;
  if (listOnly) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id("client")} label={d["trip.client"]} wide>
          <select id={id("client")} name="clientId" required value={clientId} onChange={(e) => setClientId(e.target.value)} className="input">
            <option value="" disabled>{d["trip.pickClient"]}</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            {!noNewClient && <option value="new">+ {d["trip.newClient"]}</option>}
          </select>
        </Field>
        {clientId === "new" && (
          <Field id={id("newname")} label={d["client.name"]} wide>
            <input id={id("newname")} name="newClientName" required defaultValue={v?.newClientName} className="input" />
          </Field>
        )}
        <Field id={id("cname")} label={`${d["trip.contactName"]} (${d["common.optional"]})`}>
          <input id={id("cname")} name="contactName" defaultValue={v?.contactName} className="input" />
        </Field>
        <Field id={id("cphone")} label={`${d["trip.contactPhone"]} (${d["common.optional"]})`}>
          <input id={id("cphone")} name="contactPhone" type="tel" defaultValue={v?.contactPhone} className="input" />
        </Field>
        <Field id={id("cargo")} label={d["trip.cargo"]}>
          <input id={id("cargo")} name="cargo" defaultValue={v?.cargo} className="input" />
        </Field>
        <Field id={id("smr")} label={d["trip.smrNumber"]}>
          <input id={id("smr")} name="smrNumber" defaultValue={v?.smrNumber} className="input" />
        </Field>
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id={id("client")} label={d["trip.client"]} wide>
        <select id={id("client")} name="clientId" required value={clientId} onChange={(e) => setClientId(e.target.value)} className="input">
          <option value="" disabled>{d["trip.pickClient"]}</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          {!noNewClient && <option value="new">+ {d["trip.newClient"]}</option>}
        </select>
      </Field>
      {clientId === "new" && (
        <>
          <Field id={id("newname")} label={d["client.name"]}>
            <input id={id("newname")} name="newClientName" required defaultValue={v?.newClientName} className="input" />
          </Field>
          <Field id={id("newinn")} label={d["org.inn"]}>
            <input id={id("newinn")} name="newClientInn" inputMode="numeric" defaultValue={v?.newClientInn} className="input" />
          </Field>
        </>
      )}
      <Field id={id("cname")} label={d["trip.contactName"]}>
        <input id={id("cname")} name="contactName" required defaultValue={v?.contactName} className="input" />
      </Field>
      <Field id={id("cphone")} label={d["trip.contactPhone"]}>
        <input id={id("cphone")} name="contactPhone" type="tel" required defaultValue={v?.contactPhone} placeholder="+998 90 123 45 67" className="input" />
      </Field>
      <Field id={id("cargo")} label={d["trip.cargo"]} wide>
        <input id={id("cargo")} name="cargo" defaultValue={v?.cargo} placeholder={d["trip.cargoHint"]} className="input" />
      </Field>
      <fieldset className="sm:col-span-2">
        <legend className="label">{d["trip.terms"]}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(["CONTRACT", "CASH"] as const).map((x) => (
            <label key={x} className={`flex min-h-14 cursor-pointer flex-col justify-center rounded-lg border px-3 py-2 ${terms === x ? "border-2 border-accent" : "border-line"}`}>
              <span className="font-medium"><input type="radio" name="terms" value={x} checked={terms === x} onChange={() => setTerms(x)} className="mr-2" />{d[`trip.terms.${x}`]}</span>
              <span className="text-xs text-muted">{d[`trip.terms.${x}.hint`]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field id={id("price")} label={d["trip.price"]}>
        <input id={id("price")} name="price" inputMode="decimal" required defaultValue={v?.price} className="input text-lg font-semibold tabular-nums" />
      </Field>
      <Field id={id("currency")} label={d["currency.code"]}>
        <select id={id("currency")} name="currency" defaultValue={v?.currency ?? (currencies.includes("USD") ? "USD" : currencies[0])} className="input">
          {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <Field id={id("smr")} label={d["trip.smrNumber"]}>
        <input id={id("smr")} name="smrNumber" defaultValue={v?.smrNumber} className="input" />
      </Field>
      <div className="sm:col-span-2">
        {!showAcc ? (
          <button type="button" onClick={() => setShowAcc(true)} className="min-h-11 text-sm text-accent hover:underline">+ {d["trip.accountingPrice"]}</button>
        ) : (
          <div className="grid gap-4 rounded-lg bg-ground p-4 sm:grid-cols-2">
            <p className="text-xs text-muted sm:col-span-2">{d["trip.accountingHint"]}</p>
            <Field id={id("acc")} label={d["trip.accountingPrice"]}>
              <input id={id("acc")} name="accountingPrice" inputMode="decimal" defaultValue={v?.accountingPrice} className="input tabular-nums" />
            </Field>
            <Field id={id("acccur")} label={d["currency.code"]}>
              <select id={id("acccur")} name="accountingCurrency" defaultValue={v?.accountingCurrency ?? "UZS"} className="input">
                {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Yangi tashish ----------

export type TractorOption = { id: string; label: string; pairTrailerId: string; pairDriverId: string };

export function TripForm({ d, tractors, trailers, drivers, clients, currencies, today }: {
  d: Dict; tractors: TractorOption[]; trailers: Option[]; drivers: Option[]; clients: Option[]; currencies: string[]; today: string;
}) {
  const [state, formAction, pending] = useActionState(createTrip, {});
  const v = state.values;
  const [tractorId, setTractorId] = useState(v?.tractorId ?? "");
  const [trailerId, setTrailerId] = useState(v?.trailerId ?? "");
  const [driverId, setDriverId] = useState(v?.driverId ?? "");
  const [listOnly, setListOnly] = useState(v?.listOnly === "on");
  const pick = (id: string) => {
    setTractorId(id);
    const t = tractors.find((x) => x.id === id);
    // Standart juftlik avtomatik tanlanadi, qo'lda almashtirish mumkin.
    if (t) { setTrailerId(t.pairTrailerId); setDriverId(t.pairDriverId); }
  };
  return (
    <form key={JSON.stringify(v ?? null)} action={formAction} className="grid gap-6">
      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="text-lg font-semibold sm:col-span-2">{d["trip.vehicleAndDriver"]}</h2>
        <Field id="t-tractor" label={`${d["trip.tractor"]} — ${d["trip.onlyFree"]} (${tractors.length})`} wide>
          <select id="t-tractor" name="tractorId" required value={tractorId} onChange={(e) => pick(e.target.value)} className="input">
            <option value="" disabled>{d["trip.pickTractor"]}</option>
            {tractors.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Field>
        <Field id="t-trailer" label={d["trip.trailer"]} hint={d["trip.fromPair"]}>
          <select id="t-trailer" name="trailerId" value={trailerId} onChange={(e) => setTrailerId(e.target.value)} className="input">
            <option value="">—</option>
            {trailers.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Field>
        <Field id="t-driver" label={d["trip.driver"]} hint={d["trip.fromPair"]}>
          <select id="t-driver" name="driverId" required value={driverId} onChange={(e) => setDriverId(e.target.value)} className="input">
            <option value="" disabled>—</option>
            {drivers.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Field>
        <Field id="t-from" label={d["trip.from"]}>
          <input id="t-from" name="routeFrom" required defaultValue={v?.routeFrom} className="input" />
        </Field>
        <Field id="t-to" label={d["trip.to"]}>
          <input id="t-to" name="routeTo" required defaultValue={v?.routeTo} className="input" />
        </Field>
        <Field id="t-date" label={d["trip.loadDate"]}>
          <input id="t-date" name="loadDate" type="date" required defaultValue={v?.loadDate ?? today} className="input" />
        </Field>
      </section>
      <label className={`card flex cursor-pointer items-start gap-3 p-4 ${listOnly ? "border-accent bg-accent-soft" : ""}`}>
        <input type="checkbox" name="listOnly" checked={listOnly} onChange={(e) => setListOnly(e.target.checked)} className="mt-1" />
        <span>
          <span className="font-semibold">{d["trip.listOnly"]}</span>
          <span className="block text-sm text-muted">{d["trip.listOnlyHint"]}</span>
        </span>
      </label>
      <section className="card grid gap-4 p-5">
        <h2 className="text-lg font-semibold">{d["trip.cargoAndClient"]}</h2>
        <ShipmentFields key={listOnly ? "list" : "full"} d={d} clients={clients} currencies={currencies} v={v} listOnly={listOnly} />
      </section>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn" disabled={pending}>{d["trip.save"]}</button>
        <Message state={state} d={d} />
      </div>
    </form>
  );
}

// ---------- Qo'shimcha yuk ----------

export function AddShipmentForm({ d, tripId, clients, currencies, onDone, listOnly }: {
  d: Dict; tripId: string; clients: Option[]; currencies: string[]; onDone?: () => void; listOnly?: boolean;
}) {
  const [state, formAction, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const res = await addShipment(tripId, prev, fd);
    if (res.ok) onDone?.();
    return res;
  }, {});
  return (
    <form key={state.ok ? "ok" : JSON.stringify(state.values ?? null)} action={formAction} className="grid gap-4">
      <ShipmentFields d={d} clients={clients} currencies={currencies} v={state.values} listOnly={listOnly} idp="add" />
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn" disabled={pending}>{d["common.save"]}</button>
        {state.error && <Message state={state} d={d} />}
      </div>
    </form>
  );
}

export function AddShipmentPanel({ d, tripId, clients, currencies, listOnly }: { d: Dict; tripId: string; clients: Option[]; currencies: string[]; listOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button className="btn" onClick={() => setOpen(true)}>+ {d["trip.addShipment"]}</button>;
  return (
    <div className="card grid gap-3 p-5">
      <div className="flex items-center gap-3">
        <h3 className="font-semibold">{d["trip.addShipment"]}</h3>
        <span className="flex-1" />
        <button className="text-sm text-muted hover:underline" onClick={() => setOpen(false)}>{d["common.cancel"]}</button>
      </div>
      <AddShipmentForm d={d} tripId={tripId} clients={clients} currencies={currencies} onDone={() => setOpen(false)} listOnly={listOnly} />
    </div>
  );
}

// ---------- Tahrirlash (17.11.2026) ----------

export type TripEditValues = {
  routeFrom: string; routeTo: string; loadDate: string; cargo: string; note: string;
  tractorId: string; trailerId: string; driverId: string; listOnly: boolean;
};

/** Tashish ma'lumotlarini tahrirlash: yo'nalish, sana, transport, haydovchi, "faqat ro'yxat". */
export function TripEditPanel({ d, tripId, trip, tractors, trailers, drivers }: {
  d: Dict; tripId: string; trip: TripEditValues; tractors: Option[]; trailers: Option[]; drivers: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const res = await updateTrip(tripId, prev, fd);
    if (res.ok) setOpen(false);
    return res;
  }, {});
  if (!open) return <button className="btn-ghost" onClick={() => setOpen(true)}>✎ {d["common.edit"]}</button>;
  const v = state.values;
  const val = (k: keyof TripEditValues) => (v?.[k] ?? String(trip[k] ?? ""));
  return (
    <form key={JSON.stringify(v ?? null)} action={formAction} className="card grid w-full gap-4 border-2 border-accent p-5 sm:grid-cols-2">
      <div className="flex items-center gap-3 sm:col-span-2">
        <h2 className="flex-1 text-lg font-semibold">{d["trip.editTitle"]}</h2>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>✕ {d["common.close"]}</button>
      </div>
      <Field id="te-from" label={d["trip.from"]}><input id="te-from" name="routeFrom" required defaultValue={val("routeFrom")} className="input" /></Field>
      <Field id="te-to" label={d["trip.to"]}><input id="te-to" name="routeTo" required defaultValue={val("routeTo")} className="input" /></Field>
      <Field id="te-date" label={d["trip.loadDate"]}><input id="te-date" name="loadDate" type="date" required defaultValue={val("loadDate")} className="input" /></Field>
      <Field id="te-cargo" label={d["trip.cargo"]}><input id="te-cargo" name="cargo" defaultValue={val("cargo")} className="input" /></Field>
      <Field id="te-tractor" label={d["trip.tractor"]}>
        <select id="te-tractor" name="tractorId" defaultValue={val("tractorId")} className="input">
          {tractors.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
      </Field>
      <Field id="te-trailer" label={d["trip.trailer"]}>
        <select id="te-trailer" name="trailerId" defaultValue={val("trailerId")} className="input">
          <option value="">—</option>
          {trailers.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
      </Field>
      <Field id="te-driver" label={d["trip.driver"]}>
        <select id="te-driver" name="driverId" defaultValue={val("driverId")} className="input">
          {drivers.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
      </Field>
      <Field id="te-note" label={d["common.note"]}><input id="te-note" name="note" defaultValue={val("note")} className="input" /></Field>
      <label className="flex items-start gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="listOnly" defaultChecked={v ? v.listOnly === "on" : trip.listOnly} className="mt-1" />
        <span><span className="font-semibold">{d["trip.listOnly"]}</span><span className="block text-xs text-muted">{d["trip.listOnlyHint"]}</span></span>
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button className="btn" disabled={pending}>{d["common.save"]}</button>
        <Message state={state} d={d} />
      </div>
    </form>
  );
}

/** Yuk qismini tahrirlash: mijoz, mas'ul shaxs, yuk, shartnoma turi, narx, valyuta. */
export function ShipmentEditPanel({ d, shipmentId, values, clients, currencies, listOnly, paid }: {
  d: Dict; shipmentId: string; values: Record<string, string>; clients: Option[]; currencies: string[]; listOnly: boolean; paid: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const res = await updateShipment(shipmentId, prev, fd);
    if (res.ok) setOpen(false);
    return res;
  }, {});
  if (!open) return <button className="btn-ghost" onClick={() => setOpen(true)}>✎ {d["common.edit"]}</button>;
  return (
    <form key={JSON.stringify(state.values ?? null)} action={formAction} className="grid gap-3 rounded-lg border-2 border-accent p-3">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-sm font-semibold">{d["trip.editShipment"]}</span>
        <button type="button" className="text-sm text-muted hover:text-ink" onClick={() => setOpen(false)} aria-label={d["common.close"]}>✕</button>
      </div>
      {paid && <p className="rounded-md bg-warn-soft px-2 py-1 text-xs text-warn">{d["trip.paidLockHint"]}</p>}
      <ShipmentFields d={d} clients={clients} currencies={currencies} v={state.values ?? values} listOnly={listOnly} noNewClient idp={`se-${shipmentId}`} />
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn" disabled={pending}>{d["common.save"]}</button>
        <Message state={state} d={d} />
      </div>
    </form>
  );
}

// ---------- Holat: menejer haydovchi o'rniga ----------

export function EventForm({ d, tripId, allowed, now }: { d: Dict; tripId: string; allowed: TripEventType[]; now: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const res = await addTripEvent(tripId, prev, fd);
    if (res.ok) setOpen(false);
    return res;
  }, {});
  if (!allowed.length) return null;
  if (!open) {
    return <button className="btn-ghost border-accent text-accent" onClick={() => setOpen(true)}>{d["trip.markForDriver"]}</button>;
  }
  return (
    <form action={formAction} className="grid w-full gap-3 rounded-lg bg-ground p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <Field id="e-type" label={d["trip.event"]}>
        <select id="e-type" name="type" defaultValue={allowed[0]} className="input">
          {allowed.map((t) => <option key={t} value={t}>{d[`trip.ev.${t}`]}</option>)}
        </select>
      </Field>
      <Field id="e-at" label={d["trip.eventAt"]}>
        <input id="e-at" name="at" type="datetime-local" required defaultValue={now} max={now} className="input" />
      </Field>
      <div className="flex gap-2">
        <button className="btn" disabled={pending}>{d["common.save"]}</button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>{d["common.cancel"]}</button>
      </div>
      <input name="note" aria-label={d["common.note"]} placeholder={d["trip.eventNote"]} className="input sm:col-span-3" />
      {state.error && <div className="sm:col-span-3"><Message state={state} d={d} /></div>}
    </form>
  );
}

export function CancelTripButton({ d, tripId }: { d: Dict; tripId: string }) {
  const [state, action, pending] = useActionState(async () => cancelTrip(tripId), {} as FormState);
  return (
    <form action={action} onSubmit={(e) => { if (!window.confirm(d["trip.cancelConfirm"])) e.preventDefault(); }}>
      <button className="btn-danger" disabled={pending}>{d["trip.cancel"]}</button>
      {state.error && <Message state={state} d={d} />}
    </form>
  );
}
