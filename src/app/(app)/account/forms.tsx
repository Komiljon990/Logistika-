"use client";

import { useActionState, useState } from "react";
import type { Dict } from "@/i18n";
import {
  changePassword, confirmEmailChange, createGrant, requestEmailChange, revokeGrants,
  type AccState, type EmailState, type GrantState,
} from "./actions";

function Msg({ d, error, ok }: { d: Dict; error?: keyof Dict; ok?: string }) {
  if (error) return <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{d[error]}</p>;
  if (ok) return <p className="text-sm text-accent">{ok}</p>;
  return null;
}

export function PasswordForm({ d }: { d: Dict }) {
  const [state, action, pending] = useActionState(changePassword, {} as AccState);
  return (
    <form action={action} key={state.ok ? "done" : "form"} className="grid gap-3 sm:grid-cols-3">
      <div>
        <label htmlFor="current" className="label">{d["acc.currentPassword"]}</label>
        <input id="current" name="current" type="password" autoComplete="current-password" required className="input" />
      </div>
      <div>
        <label htmlFor="new-password" className="label">{d["user.newPassword"]}</label>
        <input id="new-password" name="password" type="password" autoComplete="new-password" minLength={8} required className="input" />
      </div>
      <div>
        <label htmlFor="new-password2" className="label">{d["user.passwordConfirm"]}</label>
        <input id="new-password2" name="passwordConfirm" type="password" autoComplete="new-password" minLength={8} required className="input" />
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <button className="btn" disabled={pending}>{d["acc.changePassword"]}</button>
        <Msg d={d} error={state.error} ok={state.ok ? d["acc.passwordChanged"] : undefined} />
      </div>
    </form>
  );
}

export function EmailForm({ d, current }: { d: Dict; current: string | null }) {
  const [req, reqAction, reqPending] = useActionState(requestEmailChange, {} as EmailState);
  const [conf, confAction, confPending] = useActionState(confirmEmailChange, {} as EmailState);
  if (conf.ok) return <p className="text-sm text-accent">{d["acc.emailChanged"]}</p>;
  const step = conf.step ?? req.step;
  const email = conf.email ?? req.email;
  if (step === "code") {
    return (
      <div className="grid gap-3">
        <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm">{d["code.sentTo"].replace("{email}", email ?? "")}</p>
        <form action={confAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="email" value={email} />
          <div>
            <label htmlFor="email-code" className="label">{d["code.code"]}</label>
            <input id="email-code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required className="input w-40 font-mono tracking-widest" />
          </div>
          <button className="btn" disabled={confPending}>{d["acc.confirm"]}</button>
        </form>
        <Msg d={d} error={conf.error ?? req.error} />
      </div>
    );
  }
  return (
    <form action={reqAction} className="flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1">
        <label htmlFor="new-email" className="label">{current ? d["acc.newEmail"] : d["code.email"]}</label>
        <input id="new-email" name="email" type="email" autoComplete="email" required className="input" />
      </div>
      <button className="btn-ghost" disabled={reqPending}>{d["code.send"]}</button>
      <div className="w-full"><Msg d={d} error={req.error} /></div>
    </form>
  );
}

export function GrantForm({ d, locale }: { d: Dict; locale: string }) {
  const [state, action, pending] = useActionState(createGrant, {} as GrantState);
  const [copied, setCopied] = useState(false);
  const fmt = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "uz-UZ", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Tashkent" });
  return (
    <div className="grid gap-4">
      {state.password && (
        <div className="grid gap-2 rounded-xl border border-dashed border-accent bg-accent-soft p-4">
          <span className="text-sm font-semibold">{d["acc.grantCreated"]}</span>
          <div className="flex flex-wrap items-center gap-3">
            <code className="select-all rounded-lg bg-paper px-3 py-2 font-mono text-xl tracking-wider">{state.password}</code>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => navigator.clipboard?.writeText(state.password!).then(() => setCopied(true), () => {})}
            >
              {copied ? d["acc.copied"] : d["acc.copy"]}
            </button>
          </div>
          <span className="text-xs text-muted">
            {d[state.mode === "EDIT" ? "acc.modeEDIT" : "acc.modeVIEW"]} · {d["acc.until"]} {fmt.format(new Date(state.expiresAt!))}
          </span>
          <span className="text-xs text-muted">{d["acc.grantOnce"]}</span>
        </div>
      )}
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="grant-mode" className="label">{d["acc.mode"]}</label>
          <select id="grant-mode" name="mode" defaultValue="VIEW" className="input w-auto">
            <option value="VIEW">{d["acc.modeVIEW"]}</option>
            <option value="EDIT">{d["acc.modeEDIT"]}</option>
          </select>
        </div>
        <div>
          <label htmlFor="grant-hours" className="label">{d["acc.duration"]}</label>
          <select id="grant-hours" name="hours" defaultValue="8" className="input w-auto">
            <option value="1">{d["acc.h1"]}</option>
            <option value="8">{d["acc.h8"]}</option>
            <option value="24">{d["acc.h24"]}</option>
            <option value="72">{d["acc.h72"]}</option>
          </select>
        </div>
        <button className="btn" disabled={pending}>{d["acc.createGrant"]}</button>
      </form>
      <Msg d={d} error={state.error} />
    </div>
  );
}

export function RevokeButton({ d }: { d: Dict }) {
  return (
    <form action={revokeGrants}>
      <button className="btn-danger">{d["acc.revoke"]}</button>
    </form>
  );
}
