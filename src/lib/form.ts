import type { Dict } from "@/i18n/uz";

export type FormState = { error?: keyof Dict; ok?: boolean; newPassword?: string; values?: Record<string, string> };

/** React forma xatodan keyin tozalanadi; kiritilgan qiymatlar (parol va fayllarsiz) qaytarilib qayta to'ldiriladi. */
export function fail(error: keyof Dict, formData: FormData): FormState {
  const values: Record<string, string> = {};
  for (const [k, v] of formData) if (typeof v === "string" && k !== "password" && !k.startsWith("$")) values[k] = v;
  return { error, values };
}

export function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function optStr(formData: FormData, key: string, max = 500): string | null {
  return str(formData, key).slice(0, max) || null;
}
