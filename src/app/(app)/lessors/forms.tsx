"use client";

import { useActionState, useState } from "react";
import type { Dict } from "@/i18n";
import type { FormState } from "@/lib/form";
import { addLessorEntry, cancelLessorEntry, createLessor, setLessorStatus, updateLessor } from "./actions";

function Msg({ state, d, ok }: { state: FormState; d: Dict; ok?: string }) {
  if (state.error) return <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{d[state.error]}</p>;
  if (state.ok && ok) return <p role="status" className="text-sm text-accent">{ok}</p>;
  return null;
}

export type LessorValues = { name: string; phone: string; inn: string; note: string };

export function LessorForm({ d, id, lessor }: { d: Dict; id?: string; lessor?: LessorValues }) {
  const [state, action, pending] = useActionState(id ? updateLessor.bind(null, id) : createLessor, {} as FormState);
  const v = (k: keyof LessorValues) => state.values?.[k] ?? lessor?.[k] ?? "";
  return (
    <form key={JSON.stringify(state.values ?? null)} action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor="l-name" className="label">{d["lessor.name"]}</label>
        <input id="l-name" name="name" required maxLength={200} defaultValue={v("name")} placeholder={d["lessor.namePh"]} className="input" />
      </div>
      <div>
        <label htmlFor="l-phone" className="label">{d["user.phone"]}</label>
        <input id="l-phone" name="phone" type="tel" defaultValue={v("phone")} placeholder="+998 90 123 45 67" className="input" />
      </div>
      <div>
        <label htmlFor="l-inn" className="label">{d["org.inn"]}</label>
        <input id="l-inn" name="inn" inputMode="numeric" defaultValue={v("inn")} className="input" />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="l-note" className="label">{d["common.note"]}</label>
        <input id="l-note" name="note" maxLength={300} defaultValue={v("note")} className="input" />
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button className="btn" disabled={pending}>{id ? d["common.save"] : d["common.add"]}</button>
        <Msg state={state} d={d} ok={d["common.saved"]} />
      </div>
    </form>
  );
}

type Opt = { id: string; label: string };
type AccountOpt = { id: string; label: string; currency: string };

/** "+ Hisob qo'shish" va "+ To'lov" tugmalari va ularning oynalari. */
export function LessorEntryButtons({ d, lessorId, currencies, accounts, vehicles, today }: {
  d: Dict; lessorId: string; currencies: string[]; accounts: AccountOpt[]; vehicles: Opt[]; today: string;
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
          key={open} d={d} lessorId={lessorId} kind={open} currencies={currencies} accounts={open === "PAYMENT" ? accounts : []}
          vehicles={vehicles} today={today} onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function EntryForm({ d, lessorId, kind, currencies, accounts, vehicles, today, onClose }: {
  d: Dict; lessorId: string; kind: "CHARGE" | "PAYMENT"; currencies: string[]; accounts: AccountOpt[]; vehicles: Opt[]; today: string; onClose: () => void;
}) {
  const [saved, setSaved] = useState(0);
  const [accountId, setAccountId] = useState(accounts.length === 1 ? accounts[0].id : "");
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await addLessorEntry(lessorId, kind, prev, fd);
    if (r.ok) setSaved((n) => n + 1);
    return r;
  }, {} as FormState);
  const cur = accounts.find((a) => a.id === accountId)?.currency;
  return (
    <form key={saved} action={action} className={`card grid gap-3 border-2 p-4 sm:grid-cols-2 ${kind === "CHARGE" ? "border-warn" : "border-accent"}`}>
      <div className="flex items-center gap-2 sm:col-span-2">
        <h3 className="flex-1 font-semibold">{kind === "CHARGE" ? d["lessor.chargeTitle"] : d["lessor.paymentTitle"]}</h3>
        <button type="button" className="btn-ghost" onClick={onClose}>✕ {d["common.close"]}</button>
      </div>
      <p className="text-xs text-muted sm:col-span-2">{kind === "CHARGE" ? d["lessor.chargeHint"] : d["lessor.paymentHint"]}</p>
      {kind === "PAYMENT" && accounts.length > 0 && (
        <div className="sm:col-span-2">
          <label htmlFor="le-acc" className="label">{d["cash.fromAccount"]}</label>
          <select id="le-acc" name="accountId" required value={accountId} onChange={(e) => setAccountId(e.target.value)} className="input">
            <option value="" disabled>{d["pay.pickAccount"]}</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>
      )}
      <div>
        <label htmlFor="le-amount" className="label">{d["cash.amount"]}{cur ? `, ${cur}` : ""}</label>
        <input id="le-amount" name="amount" required inputMode="decimal" defaultValue={state.values?.amount} className="input text-lg font-semibold tabular-nums" />
      </div>
      {!(kind === "PAYMENT" && accounts.length > 0) ? (
        <div>
          <label htmlFor="le-cur" className="label">{d["currency.code"]}</label>
          <select id="le-cur" name="currency" defaultValue={state.values?.currency ?? (currencies.includes("UZS") ? "UZS" : currencies[0])} className="input">
            {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      ) : (
        <input type="hidden" name="currency" value={cur ?? ""} />
      )}
      <div>
        <label htmlFor="le-date" className="label">{d["pay.date"]}</label>
        <input id="le-date" name="date" type="date" required max={today} defaultValue={state.values?.date ?? today} className="input" />
      </div>
      <div>
        <label htmlFor="le-veh" className="label">{d["lessor.vehicle"]}</label>
        <select id="le-veh" name="vehicleId" defaultValue={state.values?.vehicleId ?? ""} className="input">
          <option value="">—</option>
          {vehicles.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="le-note" className="label">{d["common.note"]}</label>
        <input id="le-note" name="note" maxLength={300} defaultValue={state.values?.note} placeholder={kind === "CHARGE" ? d["lessor.chargeNotePh"] : ""} className="input" />
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button className="btn" disabled={pending}>{d["common.save"]}</button>
        <Msg state={state} d={d} ok={d["common.saved"]} />
      </div>
    </form>
  );
}

export function CancelLessorEntryButton({ d, id }: { d: Dict; id: string }) {
  const [, action, pending] = useActionState(async () => { await cancelLessorEntry(id); return {}; }, {});
  return (
    <form action={action} onSubmit={(e) => { if (!window.confirm(d["cash.deleteConfirm"])) e.preventDefault(); }} className="inline">
      <button className="text-sm text-muted hover:underline" disabled={pending}>{d["common.delete"]}</button>
    </form>
  );
}

export function LessorStatusButton({ d, id, active }: { d: Dict; id: string; active: boolean }) {
  const [, action, pending] = useActionState(async () => { await setLessorStatus(id, active ? "ARCHIVED" : "ACTIVE"); return {}; }, {});
  return (
    <form action={action} onSubmit={(e) => { if (active && !window.confirm(d["lessor.archiveConfirm"])) e.preventDefault(); }}>
      <button className={active ? "btn-ghost" : "btn"} disabled={pending}>{active ? d["common.archive"] : d["common.restore"]}</button>
    </form>
  );
}
