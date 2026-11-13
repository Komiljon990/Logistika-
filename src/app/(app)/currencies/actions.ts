"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { orgForWrite } from "@/lib/scope";
import { BASE } from "@/lib/currency-core";
import { seedOrgCurrencies } from "@/lib/org-currency";
import { knownCurrencies } from "@/lib/rates";

export type CurrencyState = { error?: "currency.error.unknown" | "currency.error.base"; ok?: boolean };

/** Rahbar o'z tashkilotiga Markaziy bank ro'yxatidagi valyutani qo'shadi (yoki qayta faollashtiradi). */
export async function addCurrency(_prev: CurrencyState, formData: FormData): Promise<CurrencyState> {
  const user = await requirePermission("currency.manage");
  const orgId = orgForWrite(user);
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const known = await knownCurrencies();
  if (!known.some((k) => k.code === code)) return { error: "currency.error.unknown" };
  await seedOrgCurrencies(orgId);
  await db.orgCurrency.upsert({
    where: { orgId_code: { orgId, code } },
    update: { active: true },
    create: { orgId, code },
  });
  await audit({ actorId: user.id, orgId, action: "currency.add", entity: "OrgCurrency", entityId: code });
  revalidatePath("/currencies");
  return { ok: true };
}

export async function setCurrencyActive(code: string, active: boolean): Promise<CurrencyState> {
  const user = await requirePermission("currency.manage");
  const orgId = orgForWrite(user);
  if (code === BASE) return { error: "currency.error.base" };
  await seedOrgCurrencies(orgId);
  const row = await db.orgCurrency.findUnique({ where: { orgId_code: { orgId, code } } });
  if (!row) return { error: "currency.error.unknown" };
  await db.orgCurrency.update({ where: { id: row.id }, data: { active } });
  await audit({ actorId: user.id, orgId, action: "currency.status", entity: "OrgCurrency", entityId: code, details: { active } });
  revalidatePath("/currencies");
  return { ok: true };
}
