"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LANG_COOKIE, isLocale } from "@/i18n";
import { destroySession, requireSession, switchSession } from "@/lib/session";

/** Tashkilotni almashtirish (bir shaxs bir nechta tashkilotda). Ma'lumotlar jamlanmaydi — sessiya boshqa a'zolikka o'tadi. */
export async function switchOrg(formData: FormData) {
  const user = await requireSession();
  const ok = await switchSession(user, String(formData.get("userId") ?? ""));
  redirect(ok ? "/" : "/select-org");
}

export async function setLanguage(formData: FormData) {
  const lang = formData.get("lang");
  if (isLocale(lang)) {
    (await cookies()).set(LANG_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
