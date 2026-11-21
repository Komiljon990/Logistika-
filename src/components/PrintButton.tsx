"use client";

/** Sahifani chop etish / PDF saqlash (brauzerning chop etish oynasi). */
export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" className="btn-ghost print:hidden" onClick={() => window.print()}>
      {label}
    </button>
  );
}
