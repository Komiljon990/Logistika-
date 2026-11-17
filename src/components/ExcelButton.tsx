"use client";

import { buildXlsx, parseCell, type Cell } from "@/lib/xlsx";

/**
 * Sahifadagi jadvalni (filtrlangan/saralangan ko'rinishda) Excel faylga yuklab beradi.
 * `target` — jadval id si; berilmasa tugmaga eng yaqin keyingi jadval. `data-noexport` li ustunlar tashlab ketiladi.
 */
export function ExcelButton({ label, target, file }: { label: string; target?: string; file: string }) {
  const run = (btn: HTMLButtonElement) => {
    let table: HTMLTableElement | null = target ? (document.getElementById(target) as HTMLTableElement | null) : null;
    if (!table) {
      let el: Element | null = btn.closest("section, main");
      table = el?.querySelector("table") ?? null;
      if (!table) { el = document.querySelector("main"); table = el?.querySelector("table") ?? null; }
    }
    if (!table) return;
    const rows: Cell[][] = [];
    for (const tr of Array.from(table.rows)) {
      const row: Cell[] = [];
      for (const cell of Array.from(tr.cells)) {
        if (cell.hasAttribute("data-noexport")) continue;
        // Bir katakdagi bir nechta qator (masalan har valyuta alohida) — bitta katakda " · " bilan.
        const lines = cell.innerText.split("\n").map((x) => x.trim()).filter(Boolean);
        row.push(lines.length === 1 ? parseCell(lines[0]) : lines.length ? lines.join(" · ") : null);
        for (let i = 1; i < (cell.colSpan || 1); i++) row.push(null);
      }
      if (row.some((c) => c !== null)) rows.push(row);
    }
    const bytes = buildXlsx(rows, file.slice(0, 31));
    const blob = new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${file.replace(/[\\/:*?"<>|]+/g, " ").trim() || "jadval"}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  return (
    <button type="button" onClick={(e) => run(e.currentTarget)} className="btn-ghost print:hidden" title={label}>
      <span aria-hidden className="mr-1 font-bold text-accent">⤓</span>{label}
    </button>
  );
}
