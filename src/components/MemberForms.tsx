"use client";

import { useActionState } from "react";
import type { Role } from "@prisma/client";
import type { Dict } from "@/i18n";
import type { FormState } from "@/lib/form";

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
export function MemberForm({ d, action, roles, member, submit }: {
  d: Dict;
  action: Action;
  roles?: readonly Role[];
  member?: { fullName: string; email: string | null; phone: string; role: Role };
  submit: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const v = state.values;
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
          <select id="m-role" name="role" defaultValue={v?.role ?? member?.role ?? roles[0]} className="input">
            {roles.map((r) => <option key={r} value={r}>{d[`role.${r}`]}</option>)}
          </select>
        </div>
      )}
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
