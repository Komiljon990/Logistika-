"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

type Labels = {
  phone: string;
  password: string;
  submit: string;
  errors: Record<NonNullable<LoginState["error"]>, string>;
};

export function LoginForm({ labels }: { labels: Labels }) {
  const [state, action, pending] = useActionState(loginAction, {});
  return (
    <form action={action} className="grid gap-4">
      <div>
        <label htmlFor="phone" className="label">{labels.phone}</label>
        <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="username" required placeholder="+998 90 123 45 67" className="input" />
      </div>
      <div>
        <label htmlFor="password" className="label">{labels.password}</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      {state.error && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{labels.errors[state.error]}</p>}
      <button className="btn" disabled={pending}>{labels.submit}</button>
    </form>
  );
}
