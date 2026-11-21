"use client";

import { useActionState } from "react";
import { undoActivity } from "./actions";

export function UndoButton({ id, label, confirm, errorText }: { id: string; label: string; confirm: string; errorText: string }) {
  const [state, action, pending] = useActionState(async () => undoActivity(id), {} as Awaited<ReturnType<typeof undoActivity>>);
  return (
    <form action={action} className="inline" onSubmit={(e) => { if (!window.confirm(confirm)) e.preventDefault(); }}>
      <button className="text-sm text-bad hover:underline" disabled={pending}>{label}</button>
      {state.error && <span role="alert" className="ml-2 text-xs text-bad">{errorText}</span>}
    </form>
  );
}
