"use client";

import { useActionState } from "react";
import type { Dict } from "@/i18n";
import type { ImportKind } from "@/lib/import-core";
import { importRows, type ImportState } from "./actions";

export function ImportForm({ d, kind, back }: { d: Dict; kind: ImportKind; back: string }) {
  const [state, action, pending] = useActionState(importRows.bind(null, kind), {} as ImportState);
  return (
    <form action={action} className="grid gap-3">
      <label htmlFor="imp-file" className="label">{d["imp.file"]}</label>
      <input id="imp-file" name="file" type="file" required accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" className="input" />
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn" disabled={pending}>{pending ? d["common.loading"] : d["imp.run"]}</button>
      </div>
      {state.error && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{d[state.error]}</p>}
      {state.ok && (
        <div role="status" className="grid gap-2 rounded-lg border border-accent bg-accent-soft p-3 text-sm">
          <p className="font-semibold">{d["imp.done"].replace("{n}", String(state.added ?? 0)).replace("{m}", String(state.skipped?.length ?? 0))}</p>
          {!!state.skipped?.length && (
            <ul className="max-h-48 list-inside list-disc overflow-y-auto text-xs">
              {state.skipped.map((s) => <li key={s.row}>{d["imp.row"].replace("{n}", String(s.row))}: {d[`imp.skip.${s.reason}`]}</li>)}
            </ul>
          )}
          <a href={back} className="text-accent hover:underline">{d["imp.openList"]} →</a>
        </div>
      )}
    </form>
  );
}
