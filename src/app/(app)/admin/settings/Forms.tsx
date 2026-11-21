"use client";

import { useActionState } from "react";
import type { Dict } from "@/i18n";
import type { Provider } from "@/lib/settings";
import { saveProviderAction, saveTelegramChat } from "./actions";

type State = { error?: string; ok?: boolean };

function Msg({ d, state }: { d: Dict; state: State }) {
  if (state.error) return <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{d[state.error as keyof Dict] ?? state.error}</p>;
  if (state.ok) return <p className="text-sm text-accent">{d["common.saved"]}</p>;
  return null;
}

const FIELDS: { key: keyof Provider; label: keyof Dict; required?: boolean; wide?: boolean }[] = [
  { key: "name", label: "set.p.name", required: true, wide: true },
  { key: "inn", label: "org.inn", required: true },
  { key: "director", label: "role.DIRECTOR" },
  { key: "address", label: "set.p.address", wide: true },
  { key: "bank", label: "set.p.bank", required: true },
  { key: "mfo", label: "set.p.mfo", required: true },
  { key: "account", label: "set.p.account", required: true },
  { key: "phone", label: "user.phone" },
  { key: "email", label: "reg.email" },
];

export function ProviderForm({ d, provider }: { d: Dict; provider: Provider }) {
  const [state, action, pending] = useActionState(saveProviderAction, {} as State);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {FIELDS.map((f) => (
        <div key={f.key} className={f.wide ? "sm:col-span-2" : ""}>
          <label htmlFor={`p-${f.key}`} className="label">{d[f.label]}{f.required ? " *" : ""}</label>
          <input id={`p-${f.key}`} name={f.key} required={f.required} maxLength={300} defaultValue={provider[f.key]} className="input" />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button className="btn" disabled={pending}>{d["common.save"]}</button>
        <Msg d={d} state={state} />
      </div>
    </form>
  );
}

export function TelegramChatForm({ d, chatId, chats }: { d: Dict; chatId: string; chats: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(saveTelegramChat, {} as State);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor="tg-chat" className="label">{d["tg.chatId"]}</label>
        <input id="tg-chat" name="chatId" list="tg-chats" defaultValue={chatId} className="input w-56 tabular-nums" />
        <datalist id="tg-chats">{chats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</datalist>
      </div>
      <button className="btn" disabled={pending}>{d["common.save"]}</button>
      <div className="w-full"><Msg d={d} state={state} /></div>
    </form>
  );
}
