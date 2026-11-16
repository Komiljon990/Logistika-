"use client";

import { useActionState } from "react";
import type { Dict } from "@/i18n";
import { FILE_ACCEPT } from "@/lib/files";
import { requestRenewal, requestUpgrade } from "./actions";

type State = { error?: keyof Dict; ok?: boolean };

function Msg({ d, state, ok }: { d: Dict; state: State; ok?: string }) {
  if (state.error) return <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{d[state.error]}</p>;
  if (state.ok) return <p className="text-sm text-accent">{ok ?? d["common.saved"]}</p>;
  return null;
}

export function ReceiptForm({ d, action }: { d: Dict; action: (prev: State, formData: FormData) => Promise<State> }) {
  const [state, formAction, pending] = useActionState(action, {} as State);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input name="file" type="file" required accept={FILE_ACCEPT} className="max-w-56 text-sm" />
      <button className="btn" disabled={pending}>{d["sub.upload"]}</button>
      <Msg d={d} state={state} ok={d["sub.uploaded"]} />
    </form>
  );
}

export function UpgradeForm({ d, options }: { d: Dict; options: { id: string; label: string; price: string }[] }) {
  const [state, action, pending] = useActionState(requestUpgrade, {} as State);
  return (
    <form action={action} className="grid gap-3">
      <div className="grid gap-2">
        {options.map((o, i) => (
          <label key={o.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
            <input type="radio" name="plan" value={o.id} defaultChecked={i === 0} />
            <span className="flex-1 font-semibold">{o.label}</span>
            <span className="tabular-nums">{o.price}</span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn" disabled={pending}>{d["sub.createInvoice"]}</button>
        <Msg d={d} state={state} ok={d["sub.invoiceCreated"]} />
      </div>
    </form>
  );
}

export function RenewForm({ d, plans, current }: {
  d: Dict; plans: { id: string; label: string; monthly: string; yearly: string; fits: boolean }[]; current: { plan: string; period: string };
}) {
  const [state, action, pending] = useActionState(requestRenewal, {} as State);
  const first = plans.find((p) => p.id === current.plan && p.fits) ?? plans.find((p) => p.fits);
  return (
    <form action={action} className="grid gap-3">
      <div className="grid gap-2">
        {plans.map((p) => (
          <label key={p.id} className={`flex flex-wrap items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm ${p.fits ? "" : "opacity-50"}`}>
            <input type="radio" name="plan" value={p.id} disabled={!p.fits} defaultChecked={p.id === first?.id} />
            <span className="flex-1 font-semibold">{p.label}</span>
            <span className="tabular-nums text-muted">{d["reg.monthly"]}: {p.monthly} · {d["reg.yearly"]}: {p.yearly}</span>
          </label>
        ))}
      </div>
      <fieldset className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="radio" name="period" value="YEARLY" defaultChecked={current.period !== "MONTHLY"} /> {d["reg.yearly"]}</label>
        <label className="flex items-center gap-2"><input type="radio" name="period" value="MONTHLY" defaultChecked={current.period === "MONTHLY"} /> {d["reg.monthly"]}</label>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn" disabled={pending}>{d["sub.createInvoice"]}</button>
        <Msg d={d} state={state} ok={d["sub.invoiceCreated"]} />
      </div>
    </form>
  );
}
