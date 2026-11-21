/** "YYYY-MM-DD" ko'rinishidagi forma qiymatini UTC sanaga aylantiradi; bo'sh yoki noto'g'ri bo'lsa null. */
export function parseDate(v: FormDataEntryValue | null): Date | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toInputDate(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  const iso = d.toISOString();
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
}
