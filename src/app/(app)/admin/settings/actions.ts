"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/session";
import { audit } from "@/lib/audit";
import { PROVIDER_FIELDS, saveProvider, setSetting, type Provider } from "@/lib/settings";
import { botToken, notifyAdmin } from "@/lib/telegram";
import { str } from "@/lib/form";

type State = { error?: string; ok?: boolean };

/** Ijrochi (ReysPro egasi) rekvizitlari — oferta va to'lov hisoblarida ko'rinadi. */
export async function saveProviderAction(_prev: State, formData: FormData): Promise<State> {
  const admin = await requirePermission("org.manage");
  const p = Object.fromEntries(PROVIDER_FIELDS.map((k) => [k, str(formData, k).slice(0, 300)])) as Provider;
  if (!p.name || !p.inn || !p.bank || !p.mfo || !p.account) return { error: "common.required" };
  await saveProvider(p);
  await audit({ actorId: admin.id, action: "settings.provider", entity: "AppSetting", entityId: "provider", details: p });
  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function saveTelegramChat(_prev: State, formData: FormData): Promise<State> {
  const admin = await requirePermission("org.manage");
  const chat = str(formData, "chatId");
  if (chat && !/^-?\d{3,20}$/.test(chat)) return { error: "tg.error.chat" };
  await setSetting("telegramChatId", chat || null);
  await audit({ actorId: admin.id, action: "settings.telegram", entity: "AppSetting", entityId: "telegramChatId" });
  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function testTelegram(_prev: State): Promise<State> {
  await requirePermission("org.manage");
  if (!botToken()) return { error: "tg.noToken" };
  return (await notifyAdmin("✅ ReysPro: sinov xabari. Bildirishnomalar shu chatga keladi.")) ? { ok: true } : { error: "tg.error.send" };
}
