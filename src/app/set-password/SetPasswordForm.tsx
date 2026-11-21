"use client";

import { useActionState } from "react";
import type { Dict } from "@/i18n";
import { setOwnPassword, type SetPasswordState } from "./actions";

export function SetPasswordForm({ d }: { d: Dict }) {
  const [state, action, pending] = useActionState(setOwnPassword, {} as SetPasswordState);
  const err = state.error === "password" ? d["user.error.password"] : state.error === "mismatch" ? d["user.error.passwordMismatch"] : state.error === "same" ? d["setpw.error.same"] : null;
  return (
    <form action={action} className="grid gap-4">
      <div>
        <label htmlFor="sp-new" className="label">{d["user.newPassword"]}</label>
        <input id="sp-new" name="password" type="password" autoComplete="new-password" minLength={8} required className="input" />
      </div>
      <div>
        <label htmlFor="sp-new2" className="label">{d["user.passwordConfirm"]}</label>
        <input id="sp-new2" name="passwordConfirm" type="password" autoComplete="new-password" minLength={8} required className="input" />
      </div>
      {err && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{err}</p>}
      <button className="btn" disabled={pending}>{d["setpw.submit"]}</button>
    </form>
  );
}
