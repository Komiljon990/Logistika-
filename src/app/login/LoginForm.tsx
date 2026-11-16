"use client";

import { useActionState, useRef } from "react";
import { loginAction, type LoginState } from "./actions";

type Labels = {
  phone: string;
  password: string;
  submit: string;
  errors: Record<NonNullable<LoginState["error"]>, string>;
};

export type DemoAccount = { role: string; phone: string; password: string };

export function LoginForm({ labels, demo, demoLabels }: {
  labels: Labels;
  demo?: DemoAccount[];
  demoLabels?: { title: string; hint: string; enter: string; login: string; password: string };
}) {
  const [state, action, pending] = useActionState(loginAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const enterDemo = (a: DemoAccount) => {
    if (!phoneRef.current || !passRef.current) return;
    phoneRef.current.value = a.phone;
    passRef.current.value = a.password;
    formRef.current?.requestSubmit();
  };
  return (
    <div className="grid gap-5">
      <form ref={formRef} action={action} className="grid gap-4">
        <div>
          <label htmlFor="phone" className="label">{labels.phone}</label>
          <input ref={phoneRef} id="phone" name="login" type="text" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required placeholder="email@misol.uz / +998 90 123 45 67" className="input" />
        </div>
        <div>
          <label htmlFor="password" className="label">{labels.password}</label>
          <input ref={passRef} id="password" name="password" type="password" autoComplete="current-password" required className="input" />
        </div>
        {state.error && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{labels.errors[state.error]}</p>}
        <button className="btn" disabled={pending}>{labels.submit}</button>
      </form>
      {demo && demo.length > 0 && demoLabels && (
        <section className="grid gap-2 rounded-xl border border-dashed border-accent bg-accent-soft p-4">
          <h2 className="font-semibold">{demoLabels.title}</h2>
          <p className="text-xs text-muted">{demoLabels.hint}</p>
          <ul className="grid gap-2">
            {demo.map((a) => (
              <li key={a.phone} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-paper px-3 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{a.role}</span>
                  <span className="block text-xs text-muted">
                    {demoLabels.login}: <span className="select-all font-mono tabular-nums">{a.phone}</span> · {demoLabels.password}: <span className="select-all font-mono">{a.password}</span>
                  </span>
                </span>
                <button type="button" onClick={() => enterDemo(a)} disabled={pending} className="btn-ghost min-h-10">{demoLabels.enter}</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
