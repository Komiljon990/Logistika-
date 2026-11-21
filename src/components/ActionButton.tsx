"use client";

import { useActionState } from "react";
import type { Dict } from "@/i18n";

type State = { error?: keyof Dict | string; ok?: boolean };

/** Bitta tugmali amal (bog'langan server action) va natija xabari. */
export function ActionButton<S extends State>({ d, action, label, className = "btn", ok, confirm }: {
  d: Dict;
  action: (prev: S) => Promise<S>;
  label: string;
  className?: string;
  ok?: string;
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action as unknown as (prev: State) => Promise<State>, {});
  return (
    <form
      action={formAction}
      className="flex flex-wrap items-center gap-3"
      onSubmit={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}
    >
      <button className={className} disabled={pending}>{label}</button>
      {state.error && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{d[state.error as keyof Dict] ?? state.error}</p>}
      {state.ok && <p className="text-sm text-accent">{ok ?? d["common.saved"]}</p>}
    </form>
  );
}
