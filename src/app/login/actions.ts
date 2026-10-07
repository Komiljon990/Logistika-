"use server";

import { redirect } from "next/navigation";
import { checkLogin } from "@/lib/login";
import { createSession } from "@/lib/session";

export type LoginState = { error?: "invalid" | "locked" | "blocked" };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const phone = String(formData.get("phone") ?? "");
  const password = String(formData.get("password") ?? "");
  const result = await checkLogin(phone, password);
  if (!result.ok) return { error: result.error };
  await createSession(result.userId, result.sessionVersion);
  redirect("/");
}
