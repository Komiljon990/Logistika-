"use client";

import { useActionState } from "react";
import { requestCode, resetWithCode, type CodeState } from "../actions";

type Labels = {
  email: string; send: string; sentTo: string; code: string; newPassword: string; confirm: string; submit: string;
  resend: string; other: string; hint: string;
  errors: Record<NonNullable<CodeState["error"]>, string>;
};

/** Ilk kirish va parolni tiklash: 1) e-mail → kod; 2) kod + yangi parol. */
export function CodeForm({ l }: { l: Labels }) {
  const [reqState, reqAction, reqPending] = useActionState(requestCode, {});
  const [setState, setAction, setPending] = useActionState(resetWithCode, {});
  const step = setState.step ?? reqState.step;
  const email = setState.email ?? reqState.email;
  const error = setState.error ?? reqState.error;

  if (step !== "code") {
    return (
      <form action={reqAction} className="grid gap-4">
        <p className="text-sm text-muted">{l.hint}</p>
        <div>
          <label htmlFor="email" className="label">{l.email}</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input" />
        </div>
        {error && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{l.errors[error]}</p>}
        <button className="btn" disabled={reqPending}>{l.send}</button>
      </form>
    );
  }
  return (
    <div className="grid gap-4">
      <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm">{l.sentTo.replace("{email}", email ?? "")}</p>
      <form action={setAction} className="grid gap-4">
        <input type="hidden" name="email" value={email} />
        <div>
          <label htmlFor="code" className="label">{l.code}</label>
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required className="input font-mono tracking-widest" />
        </div>
        <div>
          <label htmlFor="password" className="label">{l.newPassword}</label>
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="input" />
        </div>
        <div>
          <label htmlFor="passwordConfirm" className="label">{l.confirm}</label>
          <input id="passwordConfirm" name="passwordConfirm" type="password" autoComplete="new-password" minLength={8} required className="input" />
        </div>
        {error && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{l.errors[error]}</p>}
        <button className="btn" disabled={setPending}>{l.submit}</button>
      </form>
      <form action={reqAction} className="flex flex-wrap gap-3 text-sm">
        <input type="hidden" name="email" value={email} />
        <button className="text-accent hover:underline" disabled={reqPending}>{l.resend}</button>
        <a href="/login/code" className="text-accent hover:underline">{l.other}</a>
      </form>
    </div>
  );
}
