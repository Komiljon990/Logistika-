"use client";

import { useActionState } from "react";
import type { Organization } from "@prisma/client";
import type { Dict } from "@/i18n";
import { createOrg, updateOrg, type FormState } from "./actions";

function Message({ state, d }: { state: FormState; d: Dict }) {
  if (state.error) return <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{d[state.error]}</p>;
  if (state.ok) return <p className="text-sm text-accent">{d["common.saved"]}</p>;
  return null;
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/**
 * Super Admin: tashkilot nomi, STIR, e-mail va telefon. Yangi tashkilotda rahbar F.I.O.si ham kiritiladi —
 * rahbarning logini shu e-mail bo'ladi, taklifnoma unga yuboriladi.
 */
export function OrgForm({ d, org }: { d: Dict; org?: Organization }) {
  const action = org ? updateOrg.bind(null, org.id) : createOrg;
  const [state, formAction, pending] = useActionState(action, {});
  const v = state.values;
  return (
    <form key={JSON.stringify(v ?? org ?? null)} action={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field id="name" label={d["common.name"]}>
        <input id="name" name="name" required defaultValue={v?.name ?? org?.name} className="input" />
      </Field>
      <Field id="inn" label={d["org.inn"]}>
        <input id="inn" name="inn" defaultValue={v?.inn ?? org?.inn ?? ""} inputMode="numeric" className="input" />
      </Field>
      <Field id="org-email" label="E-mail" hint={org ? undefined : d["org.emailHint"]}>
        <input id="org-email" name="email" type="email" required defaultValue={v?.email ?? org?.email ?? ""} className="input" />
      </Field>
      <Field id="org-phone" label={d["org.phone"]}>
        <input id="org-phone" name="phone" type="tel" defaultValue={v?.phone ?? org?.phone ?? ""} placeholder="+998 90 123 45 67" className="input" />
      </Field>
      {!org && (
        <Field id="fullName" label={d["org.directorName"]}>
          <input id="fullName" name="fullName" required defaultValue={v?.fullName} className="input" />
        </Field>
      )}
      <Field id="address" label={d["org.address"]}>
        <input id="address" name="address" defaultValue={v?.address ?? org?.address ?? ""} className="input" />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button className="btn" disabled={pending}>{org ? d["common.save"] : d["org.createWithDirector"]}</button>
        <Message state={state} d={d} />
      </div>
    </form>
  );
}
