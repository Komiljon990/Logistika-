"use client";

import { useActionState } from "react";
import type { Dict } from "@/i18n";

type State = { error?: string; ok?: boolean };

/** Super Admin: obunani qo'lda o'zgartirish. Tarif bo'sh — cheklovsiz. */
export function SubscriptionForm({ d, action, plans, org }: {
  d: Dict;
  action: (prev: State, formData: FormData) => Promise<State>;
  plans: { id: string; label: string }[];
  org: { plan: string | null; period: string | null; subStart: string; subEnd: string; contractDate: string };
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-3">
      <div>
        <label htmlFor="s-plan" className="label">{d["reg.plan"]}</label>
        <select id="s-plan" name="plan" defaultValue={org.plan ?? ""} className="input">
          <option value="">{d["sub.noPlan"]}</option>
          {plans.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="s-period" className="label">{d["reg.period"]}</label>
        <select id="s-period" name="period" defaultValue={org.period ?? "YEARLY"} className="input">
          <option value="YEARLY">{d["reg.yearly"]}</option>
          <option value="MONTHLY">{d["reg.monthly"]}</option>
        </select>
      </div>
      <div>
        <label htmlFor="s-contract" className="label">{d["sub.contractDate"]}</label>
        <input id="s-contract" name="contractDate" type="date" defaultValue={org.contractDate} className="input" />
      </div>
      <div>
        <label htmlFor="s-start" className="label">{d["sub.start"]}</label>
        <input id="s-start" name="subStart" type="date" defaultValue={org.subStart} className="input" />
      </div>
      <div>
        <label htmlFor="s-end" className="label">{d["sub.end"]}</label>
        <input id="s-end" name="subEnd" type="date" defaultValue={org.subEnd} className="input" />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <button className="btn" disabled={pending}>{d["common.save"]}</button>
      </div>
      {state.error && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad sm:col-span-3">{d[state.error as keyof Dict] ?? state.error}</p>}
      {state.ok && <p className="text-sm text-accent sm:col-span-3">{d["common.saved"]}</p>}
    </form>
  );
}
