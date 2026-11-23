import Link from "next/link";
import { getDict, getT } from "@/i18n";
import { requirePermission } from "@/lib/session";
import { getProvider, getSetting, providerReady } from "@/lib/settings";
import { adminBotChats, adminBotToken, adminBotUsername, adminChatId, botToken, botUsername, recentChats } from "@/lib/telegram";
import { mailConfigured, senderAddress } from "@/lib/mailer";
import { ActionButton } from "@/components/ActionButton";
import { ProviderForm, TelegramChatForm } from "./Forms";
import { testTelegram } from "./actions";

/** Super Admin sozlamalari: oferta rekvizitlari, Telegram bildirishnomalari, pochta holati. */
export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ chats?: string }> }) {
  await requirePermission("org.manage");
  const [t, d] = [await getT(), await getDict()];
  const { chats: wantChats } = await searchParams;
  const provider = await getProvider();
  const token = !!botToken();
  const chatId = (await getSetting<string>("telegramChatId")) ?? "";
  const effectiveChat = await adminChatId();
  let chats: { id: string; name: string }[] = [];
  let chatsError = "";
  if (token && wantChats) {
    try { chats = await recentChats(); } catch (e) { chatsError = e instanceof Error ? e.message : String(e); }
  }
  const username = token ? await botUsername() : null;
  // 23.11.2026: alohida Super Admin boti.
  const adminBot = adminBotToken() ? await adminBotUsername() : null;
  const adminLinked = adminBotToken() ? (await adminBotChats()).length : 0;
  return (
    <div className="grid max-w-3xl gap-6">
      <h1 className="text-2xl font-bold">{t("set.title")}</h1>

      <section className="card grid gap-4 p-5">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold">{t("set.provider")}</h2>
          <p className="text-sm text-muted">{t("set.providerHint")}</p>
          {!providerReady(provider) && <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{t("set.providerMissing")}</p>}
        </div>
        <ProviderForm d={d} provider={provider} />
        <Link href="/oferta" target="_blank" className="text-sm text-accent hover:underline">{t("set.viewOffer")} ↗</Link>
      </section>

      <section className="card grid gap-4 p-5">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold">{t("tg.title")}</h2>
          <p className="text-sm text-muted">{t("tg.hint")}</p>
        </div>
        <div className="grid gap-1 rounded-lg border border-line p-3 text-sm">
          <span className="font-semibold">{t("tg.adminBot")}</span>
          {adminBotToken() ? (
            <span>
              {adminBot && <a href={`https://t.me/${adminBot}`} target="_blank" rel="noopener" className="font-semibold text-accent hover:underline">@{adminBot}</a>}
              {" · "}{adminLinked ? t("tg.adminLinked") : t("tg.adminNotLinked")}
            </span>
          ) : (
            <span className="text-muted">{t("tg.adminNoToken")}</span>
          )}
        </div>
        {!token ? (
          <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{t("tg.noToken")}</p>
        ) : (
          <>
            {username && <p className="text-sm">{t("tg.botIs")} <a href={`https://t.me/${username}`} target="_blank" rel="noopener" className="font-semibold text-accent hover:underline">@{username}</a></p>}
            <TelegramChatForm d={d} chatId={chatId} chats={chats} />
            {chats.length > 0 && (
              <ul className="grid gap-1 text-sm">
                {chats.map((c) => <li key={c.id}><span className="font-mono tabular-nums">{c.id}</span> — {c.name}</li>)}
              </ul>
            )}
            {wantChats && !chats.length && <p className="text-sm text-muted">{chatsError || t("tg.noChats")}</p>}
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/admin/settings?chats=1" className="btn-ghost">{t("tg.findChat")}</Link>
              {(effectiveChat || adminLinked > 0) && <ActionButton d={d} action={testTelegram} label={t("tg.test")} className="btn-ghost" ok={t("tg.sent")} />}
            </div>
          </>
        )}
      </section>

      <section className="card grid gap-2 p-5">
        <h2 className="text-lg font-semibold">{t("set.mail")}</h2>
        <p className="text-sm">{mailConfigured() ? t("set.mailOn").replace("{from}", senderAddress() ?? "") : t("acc.mailTestMode")}</p>
      </section>
    </div>
  );
}
