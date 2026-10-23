"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { DocType } from "@prisma/client";
import type { Dict } from "@/i18n";
import { DocForm } from "./fleet-forms";
import { archiveDocument } from "./fleet-actions";

export type DocRow = {
  id: string; type: DocType; typeLabel: string; number: string; issued: string; expires: string;
  pill: React.ReactNode; file: { id: string; name: string } | null; note: string | null;
};

export function DocsPanel({ d, owner, types, fileRequired, active, archived, archivedCount, canEdit }: {
  d: Dict; owner: { kind: "vehicle" | "driver"; id: string }; types: DocType[]; fileRequired: DocType[];
  active: DocRow[]; archived: DocRow[] | null; archivedCount: number; canEdit: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [renewing, setRenewing] = useState<string | null>(null);
  const path = usePathname();
  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">{d["doc.title"]}</h2>
        <span className="flex-1" />
        {canEdit && !adding && <button className="btn-ghost" onClick={() => setAdding(true)}>{d["doc.new"]}</button>}
      </div>
      {adding && (
        <div className="card p-5">
          <DocForm d={d} owner={owner} types={types} fileRequired={fileRequired} onDone={() => setAdding(false)} />
          <button className="mt-3 text-sm text-muted hover:underline" onClick={() => setAdding(false)}>{d["common.cancel"]}</button>
        </div>
      )}
      <DocTable d={d} rows={active} canEdit={canEdit} renewing={renewing} setRenewing={setRenewing} owner={owner} types={types} fileRequired={fileRequired} />
      {archivedCount > 0 && (
        <Link href={archived ? path : `${path}?docs=all`} className="text-sm text-accent hover:underline">
          {archived ? d["common.hideArchived"] : `${d["doc.archived"]} (${archivedCount})`}
        </Link>
      )}
      {archived && <DocTable d={d} rows={archived} muted />}
    </section>
  );
}

function DocTable({ d, rows, canEdit, muted, renewing, setRenewing, owner, types, fileRequired }: {
  d: Dict; rows: DocRow[]; canEdit?: boolean; muted?: boolean;
  renewing?: string | null; setRenewing?: (id: string | null) => void;
  owner?: { kind: "vehicle" | "driver"; id: string }; types?: DocType[]; fileRequired?: DocType[];
}) {
  if (rows.length === 0) return muted ? null : <p className="card px-4 py-6 text-sm text-muted">{d["common.none"]}</p>;
  return (
    <div className={`card overflow-x-auto ${muted ? "opacity-75" : ""}`}>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted">
          <tr>
            <th className="px-4 py-2 font-medium">{d["doc.type"]}</th>
            <th className="px-4 py-2 font-medium">{d["doc.number"]}</th>
            <th className="px-4 py-2 font-medium">{d["doc.issuedAt"]}</th>
            <th className="px-4 py-2 font-medium">{d["doc.expiresAt"]}</th>
            <th className="px-4 py-2 font-medium" />
            {canEdit && <th className="px-4 py-2" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <RowWithRenew key={r.id} r={r} d={d} canEdit={canEdit} open={renewing === r.id} setRenewing={setRenewing} owner={owner} types={types} fileRequired={fileRequired} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowWithRenew({ r, d, canEdit, open, setRenewing, owner, types, fileRequired }: {
  r: DocRow; d: Dict; canEdit?: boolean; open: boolean; setRenewing?: (id: string | null) => void;
  owner?: { kind: "vehicle" | "driver"; id: string }; types?: DocType[]; fileRequired?: DocType[];
}) {
  return (
    <>
      <tr className="border-t border-line align-top">
        <td className="px-4 py-2.5">
          <div className="font-medium">{r.typeLabel}</div>
          {r.note && <div className="text-xs text-muted">{r.note}</div>}
        </td>
        <td className="px-4 py-2.5 tabular-nums">{r.number}</td>
        <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{r.issued}</td>
        <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">
          <div>{r.expires}</div>
          <div className="mt-1">{r.pill}</div>
        </td>
        <td className="whitespace-nowrap px-4 py-2.5">
          {r.file ? (
            <a href={`/files/${r.file.id}`} target="_blank" rel="noopener" className="text-accent hover:underline">{d["doc.open"]}</a>
          ) : (
            <span className="text-xs text-muted">{d["doc.noFile"]}</span>
          )}
        </td>
        {canEdit && (
          <td className="whitespace-nowrap px-4 py-2.5 text-right">
            <button className="text-accent hover:underline" onClick={() => setRenewing?.(open ? null : r.id)}>{d["doc.renew"]}</button>
            <form action={archiveDocument.bind(null, r.id)} className="ml-3 inline">
              <button className="text-muted hover:underline">{d["common.archive"]}</button>
            </form>
          </td>
        )}
      </tr>
      {open && owner && types && fileRequired && (
        <tr>
          <td colSpan={6} className="bg-ground px-4 py-4">
            <DocForm d={d} owner={owner} types={types} fileRequired={fileRequired} renewOf={{ id: r.id, type: r.type }} onDone={() => setRenewing?.(null)} />
          </td>
        </tr>
      )}
    </>
  );
}
