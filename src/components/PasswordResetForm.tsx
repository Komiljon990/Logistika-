"use client";

import { useActionState } from "react";
import type { Dict } from "@/i18n";
import { resetPassword, type PasswordState } from "@/app/(app)/password-actions";

/** Yangi parolni qo'lda kiritish (ikki marta). Tizim parolni o'zi yaratmaydi. */
export function PasswordResetForm({ d, userId }: { d: Dict; userId: string }) {
  const [state, action, pending] = useActionState(resetPassword.bind(null, userId), {} as PasswordState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <h2 className="text-lg font-semibold sm:col-span-2">{d["user.resetPassword"]}</h2>
      <div>
        <label htmlFor="new-password" className="label">{d["user.newPassword"]}</label>
        <input id="new-password" name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </div>
      <div>
        <label htmlFor="new-password-confirm" className="label">{d["user.passwordConfirm"]}</label>
        <input id="new-password-confirm" name="passwordConfirm" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </div>
      <p className="text-xs text-muted sm:col-span-2">{d["user.passwordHint"]}</p>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button className="btn" disabled={pending}>{d["common.save"]}</button>
        {state.error && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{d[state.error]}</p>}
        {state.ok && <p className="text-sm text-accent">{d["user.passwordChanged"]}</p>}
      </div>
    </form>
  );
}
