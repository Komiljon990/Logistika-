"use client";

import { useActionState, useState, type ReactNode } from "react";
import { submitApplication, type RegisterState } from "./actions";

type Plan = { id: string; label: string; monthly: string; yearly: string; monthlyBase: string | null; yearlyBase: string | null };
type Errors = Record<NonNullable<RegisterState["error"]>, string>;

type Labels = {
  plansTitle: string; plan: string; monthly: string; yearly: string; yearlyHint: string; promo: string; countHint: string;
  period: string; offerTitle: string; accept: string; next: string; back: string; formTitle: string; orgName: string;
  inn: string; directorName: string; phone: string; email: string; emailHint: string; submit: string; done: string;
  doneHint: string; chosen: string; errors: Errors;
};

export function RegisterForm({ plans, offer, offerVersion, l }: { plans: Plan[]; offer: ReactNode; offerVersion: string; l: Labels }) {
  const [state, action, pending] = useActionState(submitApplication, {} as RegisterState);
  const v = state.values ?? {};
  const [plan, setPlan] = useState(v.plan || plans[0].id);
  const [period, setPeriod] = useState<"MONTHLY" | "YEARLY">((v.period as "MONTHLY" | "YEARLY") || "YEARLY");
  const [accepted, setAccepted] = useState(!!state.error);
  const [step, setStep] = useState<"plans" | "form">(state.error ? "form" : "plans");

  if (state.ok) {
    return (
      <div className="grid gap-2 rounded-xl border border-accent bg-accent-soft p-5">
        <p className="text-lg font-semibold">{l.done}</p>
        <p className="text-sm">{l.doneHint}</p>
      </div>
    );
  }
  const chosen = plans.find((p) => p.id === plan)!;

  if (step === "plans") {
    return (
      <div className="grid gap-5">
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">{l.plansTitle}</h2>
          {l.promo && <p className="rounded-lg border border-accent bg-accent-soft px-3 py-2 text-sm font-semibold">{l.promo}</p>}
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">{l.plan}</th>
                  <th className="px-4 py-2 text-right font-medium">{l.monthly}</th>
                  <th className="px-4 py-2 text-right font-medium">{l.yearly}</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id} className={`cursor-pointer border-t border-line ${p.id === plan ? "bg-accent-soft" : "hover:bg-accent-soft/50"}`} onClick={() => setPlan(p.id)}>
                    <td className="px-4 py-2.5">
                      <label className="flex items-center gap-2">
                        <input type="radio" name="planPick" checked={p.id === plan} onChange={() => setPlan(p.id)} />
                        <span className="font-semibold">{p.label}</span>
                      </label>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {p.monthlyBase && <s className="block text-xs text-muted">{p.monthlyBase}</s>}
                      {p.monthly}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {p.yearlyBase && <s className="block text-xs text-muted">{p.yearlyBase}</s>}
                      {p.yearly}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted">{l.yearlyHint} {l.countHint}</p>
          <fieldset className="flex flex-wrap items-center gap-4 text-sm">
            <legend className="label">{l.period}</legend>
            <label className="flex items-center gap-2"><input type="radio" name="periodPick" checked={period === "YEARLY"} onChange={() => setPeriod("YEARLY")} /> {l.yearly}</label>
            <label className="flex items-center gap-2"><input type="radio" name="periodPick" checked={period === "MONTHLY"} onChange={() => setPeriod("MONTHLY")} /> {l.monthly}</label>
          </fieldset>
        </section>
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">{l.offerTitle}</h2>
          <div className="max-h-80 overflow-y-auto rounded-xl border border-line p-4">{offer}</div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            <span>{l.accept}</span>
          </label>
        </section>
        <button type="button" className="btn justify-self-start" disabled={!accepted} onClick={() => setStep("form")}>{l.next}</button>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-4">
      <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm">
        {l.chosen}: <b>{chosen.label}</b> · {period === "YEARLY" ? `${l.yearly} — ${chosen.yearly}` : `${l.monthly} — ${chosen.monthly}`}
      </p>
      <h2 className="text-lg font-semibold">{l.formTitle}</h2>
      <input type="hidden" name="plan" value={plan} />
      <input type="hidden" name="period" value={period} />
      <input type="hidden" name="offer" value={accepted ? "on" : ""} />
      <input type="hidden" name="offerVersion" value={offerVersion} />
      {/* Robotlar uchun tuzoq: odam ko'rmaydi */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="r-org" className="label">{l.orgName} *</label>
          <input id="r-org" name="orgName" required maxLength={200} defaultValue={v.orgName} className="input" />
        </div>
        <div>
          <label htmlFor="r-inn" className="label">{l.inn} *</label>
          <input id="r-inn" name="inn" required inputMode="numeric" maxLength={16} defaultValue={v.inn} className="input tabular-nums" />
        </div>
        <div>
          <label htmlFor="r-dir" className="label">{l.directorName} *</label>
          <input id="r-dir" name="directorName" required maxLength={200} defaultValue={v.directorName} className="input" />
        </div>
        <div>
          <label htmlFor="r-phone" className="label">{l.phone} *</label>
          <input id="r-phone" name="phone" type="tel" required placeholder="+998 90 123 45 67" defaultValue={v.phone} className="input tabular-nums" />
        </div>
        <div>
          <label htmlFor="r-email" className="label">{l.email} *</label>
          <input id="r-email" name="email" type="email" required defaultValue={v.email} className="input" />
          <span className="mt-1 block text-xs text-muted">{l.emailHint}</span>
        </div>
      </div>
      {state.error && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{l.errors[state.error]}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn-ghost" onClick={() => setStep("plans")}>← {l.back}</button>
        <button className="btn" disabled={pending}>{l.submit}</button>
      </div>
    </form>
  );
}
