"use client";

import { useActionState, useEffect, useState } from "react";
import type { Dict } from "@/i18n";
import type { FormState } from "@/lib/form";
import { incomeOptions, quickIncome, type IncomeOptions } from "@/app/(app)/income-actions";

type Source = "client" | "lessor" | "other";

/** Yuqoridagi "+ Kirim" tugmasi: tushum kimdan, qancha va qayerga tushgani. */
export function QuickIncome({ d }: { d: Dict }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<IncomeOptions | null>(null);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    incomeOptions().then((o) => { if (alive) setOpts(o); });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { alive = false; window.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn min-h-9 px-3 py-1 text-sm">+ {d["income.button"]}</button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-start overflow-y-auto bg-black/40 p-4 pt-16" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="qi-title" className="card mx-auto w-full max-w-lg p-5 shadow-xl">
            <div className="mb-3 flex items-center gap-2">
              <h2 id="qi-title" className="flex-1 text-lg font-semibold">{d["income.title"]}</h2>
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>✕ {d["common.close"]}</button>
            </div>
            {!opts ? <p className="text-sm text-muted">{d["common.loading"]}</p> : <IncomeForm d={d} o={opts} onDone={() => setOpen(false)} />}
          </div>
        </div>
      )}
    </>
  );
}

function IncomeForm({ d, o, onDone }: { d: Dict; o: IncomeOptions; onDone: () => void }) {
  const sources = (["client", "lessor", "other"] as const).filter((s) => o.can[s]);
  const [source, setSource] = useState<Source>(sources[0] ?? "client");
  const [accountId, setAccountId] = useState(o.accounts.length === 1 ? o.accounts[0].id : "");
  const [saved, setSaved] = useState(false);
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await quickIncome(prev, fd);
    if (r.ok) setSaved(true);
    return r;
  }, {} as FormState);
  if (!sources.length) return <p className="text-sm text-muted">{d["income.noRights"]}</p>;
  if (saved) {
    return (
      <div className="grid gap-3">
        <p role="status" className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">{d["income.saved"]}</p>
        <div className="flex gap-2">
          <button type="button" className="btn" onClick={() => setSaved(false)}>+ {d["income.another"]}</button>
          <button type="button" className="btn-ghost" onClick={onDone}>{d["common.close"]}</button>
        </div>
      </div>
    );
  }
  const v = state.values;
  const cur = o.accounts.find((a) => a.id === accountId)?.currency;
  // "Boshqa" kirim faqat kassa hisobiga yoziladi.
  const needAccount = source === "other" || o.accounts.length > 0;
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="source" value={source} />
      <fieldset>
        <legend className="label">{d["income.from"]}</legend>
        <div className="flex flex-wrap gap-2">
          {sources.map((s) => (
            <label key={s} className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${source === s ? "border-2 border-accent bg-accent-soft font-semibold text-accent" : "border-line"}`}>
              <input type="radio" checked={source === s} onChange={() => setSource(s)} className="sr-only" />
              {d[`income.src.${s}`]}
            </label>
          ))}
        </div>
      </fieldset>
      {source === "client" && (
        <div>
          <label htmlFor="qi-client" className="label">{d["trip.client"]}</label>
          <select id="qi-client" name="clientId" required defaultValue={v?.clientId ?? ""} className="input">
            <option value="" disabled>{d["trip.pickClient"]}</option>
            {o.clients.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <p className="mt-1 text-xs text-muted">{d["income.clientHint"]}</p>
        </div>
      )}
      {source === "lessor" && (
        <div>
          <label htmlFor="qi-lessor" className="label">{d["income.src.lessor"]}</label>
          <select id="qi-lessor" name="lessorId" required defaultValue={v?.lessorId ?? ""} className="input">
            <option value="" disabled>{d["income.pickLessor"]}</option>
            {o.lessors.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
      )}
      {source === "other" && (
        <div>
          <label htmlFor="qi-party" className="label">{d["cash.party"]}</label>
          <input id="qi-party" name="party" required maxLength={200} defaultValue={v?.party} className="input" />
        </div>
      )}
      {needAccount && (
        o.accounts.length ? (
          <div>
            <label htmlFor="qi-acc" className="label">{d["ledger.toAccount"]}</label>
            <select id="qi-acc" name="accountId" required value={accountId} onChange={(e) => setAccountId(e.target.value)} className="input">
              <option value="" disabled>{d["pay.pickAccount"]}</option>
              {o.accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>
        ) : <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{d["income.noAccounts"]}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="qi-amount" className="label">{d["cash.amount"]}{cur ? `, ${cur}` : ""}</label>
          <input id="qi-amount" name="amount" required inputMode="decimal" autoFocus defaultValue={v?.amount} className="input text-lg font-semibold tabular-nums" />
        </div>
        {o.accounts.length > 0 ? <input type="hidden" name="currency" value={cur ?? ""} /> : (
          <div>
            <label htmlFor="qi-cur" className="label">{d["currency.code"]}</label>
            <select id="qi-cur" name="currency" defaultValue={v?.currency ?? (o.currencies.includes("USD") ? "USD" : o.currencies[0])} className="input">
              {o.currencies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
        {source === "client" && o.accounts.length === 0 && (
          <div>
            <label htmlFor="qi-method" className="label">{d["pay.method"]}</label>
            <select id="qi-method" name="method" defaultValue={v?.method ?? "BANK"} className="input">
              {(["BANK", "CASH", "CARD"] as const).map((m) => <option key={m} value={m}>{d[`pay.m.${m}`]}</option>)}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="qi-date" className="label">{d["pay.date"]}</label>
          <input id="qi-date" name="date" type="date" required max={o.today} defaultValue={v?.date ?? o.today} className="input" />
        </div>
      </div>
      <div>
        <label htmlFor="qi-note" className="label">{d["common.note"]}</label>
        <input id="qi-note" name="note" maxLength={300} defaultValue={v?.note} className="input" />
      </div>
      {state.error && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{d[state.error]}</p>}
      <div className="flex gap-2">
        <button className="btn" disabled={pending || (needAccount && !o.accounts.length)}>{d["common.save"]}</button>
      </div>
    </form>
  );
}
