"use client";

import { useActionState, useState } from "react";
import type { Role } from "@prisma/client";
import type { Dict } from "@/i18n";
import type { FormState } from "@/lib/form";
import { SECTIONS, type Access, type Section } from "@/lib/access";

function accessFromValues(v: Record<string, string>): Access {
  const out: Access = {};
  for (const s of SECTIONS) if (v[`acc_${s}`] === "on") out[s] = v[`lvl_${s}`] === "EDIT" ? "EDIT" : "VIEW";
  return out;
}

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

function Message({ state, d, ok }: { state: FormState; d: Dict; ok?: string }) {
  if (state.error) return <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{d[state.error]}</p>;
  if (state.ok) return <p className="text-sm text-accent">{ok ?? d["common.saved"]}</p>;
  return null;
}

/**
 * Xodim (yoki rahbar) formasi: F.I.O., e-mail, telefon, rol. Parol yo'q — shaxs e-mailiga kelgan kod orqali o'zi o'rnatadi.
 * Tahrirlashda e-mail o'zgarmaydi (u shaxsning logini).
 */
const SECTION_LABEL: Record<Section, keyof Dict> = {
  trips: "nav.trips", clients: "nav.clients", settlements: "nav.settlements", lessors: "nav.lessors", cash: "nav.cash", vehicles: "nav.vehicles",
  drivers: "nav.drivers", tir: "nav.tirOnly", dazvol: "nav.dazvol", orgdocs: "nav.orgDocs", reports: "nav.reports",
};

/** Mutaxassis: har bo'lim — belgi (ruxsat) va daraja (faqat ko'rish / kiritish, tahrirlash va o'chirish). */
function AccessMatrix({ d, initial }: { d: Dict; initial: Access }) {
  const [acc, setAcc] = useState<Access>(initial);
  return (
    <fieldset className="grid gap-2 rounded-xl border border-line p-3 sm:col-span-2">
      <legend className="px-1 text-sm font-semibold">{d["team.access"]}</legend>
      <p className="text-xs text-muted">{d["team.accessHint"]}</p>
      <div className="grid gap-1.5">
        {SECTIONS.map((s) => {
          const on = !!acc[s];
          return (
            <div key={s} className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-2 py-1.5 ${on ? "bg-accent-soft" : ""}`}>
              <label className="flex min-w-44 flex-1 items-center gap-2 text-sm font-medium">
                <input type="checkbox" name={`acc_${s}`} checked={on} onChange={(e) => setAcc({ ...acc, [s]: e.target.checked ? "VIEW" : undefined })} />
                {d[SECTION_LABEL[s]]}
              </label>
              {(["VIEW", "EDIT"] as const).map((lv) => (
                <label key={lv} className={`flex items-center gap-1.5 text-sm ${on ? "" : "opacity-40"}`}>
                  <input type="radio" name={`lvl_${s}`} value={lv} disabled={!on} checked={acc[s] === lv} onChange={() => setAcc({ ...acc, [s]: lv })} />
                  {d[`team.level.${lv}`]}
                </label>
              ))}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

export function MemberForm({ d, action, roles, member, submit }: {
  d: Dict;
  action: Action;
  roles?: readonly Role[];
  member?: { fullName: string; email: string | null; phone: string; role: Role; access?: Access | null };
  submit: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const v = state.values;
  const [role, setRole] = useState<Role>((v?.role as Role) ?? member?.role ?? roles?.[0] ?? "MANAGER");
  // Xatodan keyin forma qayta to'ldirilganda belgilangan bo'limlar saqlanadi.
  const initialAccess: Access = v ? accessFromValues(v) : member?.access ?? {};
  return (
    <form key={JSON.stringify(v ?? member ?? null)} action={formAction} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="m-name" className="label">{d["user.fullName"]}</label>
        <input id="m-name" name="fullName" required maxLength={200} defaultValue={v?.fullName ?? member?.fullName} className="input" />
      </div>
      <div>
        <label htmlFor="m-email" className="label">E-mail</label>
        {member ? (
          <input id="m-email" value={member.email ?? "—"} readOnly disabled className="input opacity-70" />
        ) : (
          <input id="m-email" name="email" type="email" required autoComplete="off" defaultValue={v?.email} className="input" />
        )}
        <p className="mt-1 text-xs text-muted">{member ? d["team.emailLocked"] : d["team.emailHint"]}</p>
      </div>
      <div>
        <label htmlFor="m-phone" className="label">{d["user.phone"]}</label>
        <input id="m-phone" name="phone" type="tel" defaultValue={v?.phone ?? member?.phone} placeholder="+998 90 123 45 67" className="input" />
        <p className="mt-1 text-xs text-muted">{d["team.phoneHint"]}</p>
      </div>
      {roles && (
        <div>
          <label htmlFor="m-role" className="label">{d["user.role"]}</label>
          <select id="m-role" name="role" value={role} onChange={(e) => setRole(e.target.value as Role)} className="input">
            {roles.map((r) => <option key={r} value={r}>{d[`role.${r}`]}</option>)}
          </select>
          {role === "SPECIALIST" && <p className="mt-1 text-xs text-muted">{d["team.specialistHint"]}</p>}
        </div>
      )}
      {roles && role === "SPECIALIST" && <AccessMatrix d={d} initial={initialAccess} />}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button className="btn" disabled={pending}>{submit}</button>
        <Message state={state} d={d} />
      </div>
    </form>
  );
}

export function ResendInviteButton({ d, action }: { d: Dict; action: (prev: FormState) => Promise<FormState> }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <button className="btn-ghost" disabled={pending}>{d["team.resendInvite"]}</button>
      <Message state={state} d={d} ok={d["team.inviteSent"]} />
    </form>
  );
}
