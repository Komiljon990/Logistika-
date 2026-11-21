"use client";

import { useActionState } from "react";
import type { Dict } from "@/i18n";
import { addCurrency, setCurrencyActive, type CurrencyState } from "./actions";

export function AddCurrencyForm({ d, options }: { d: Dict; options: { code: string; name: string }[] }) {
  const [state, action, pending] = useActionState(addCurrency, {} as CurrencyState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1 basis-60">
        <label htmlFor="cur-code" className="label">{d["currency.code"]}</label>
        <select id="cur-code" name="code" required className="input">
          {options.map((o) => <option key={o.code} value={o.code}>{o.code} — {o.name}</option>)}
        </select>
      </div>
      <button className="btn" disabled={pending}>{d["common.add"]}</button>
      {state.error && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{d[state.error]}</p>}
    </form>
  );
}

export function CurrencyToggle({ d, code, active }: { d: Dict; code: string; active: boolean }) {
  const [, action, pending] = useActionState(async () => setCurrencyActive(code, !active), {} as CurrencyState);
  return (
    <form action={action} className="inline">
      <button className={active ? "text-muted hover:underline" : "text-accent hover:underline"} disabled={pending}>
        {active ? d["currency.deactivate"] : d["common.restore"]}
      </button>
    </form>
  );
}
