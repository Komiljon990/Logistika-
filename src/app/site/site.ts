import "server-only";
import { headers } from "next/headers";

/** Sayt havolalari: reyspro.uz domenida "/" dan, lokal tarmoqda (sinov) "/site" dan boshlanadi. */
export async function siteBase(): Promise<string> {
  return (await headers()).get("x-site-root") === "1" ? "" : "/site";
}

/** Dasturga kirish manzili (CRM). Ishlab chiqarishda: https://crm.reyspro.uz */
export function crmUrl(path = ""): string {
  const base = (process.env.CRM_URL || "").replace(/\/+$/, "");
  return `${base}${path || "/login"}`;
}
