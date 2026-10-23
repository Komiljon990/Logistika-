"use client";

import { useActionState } from "react";
import type { Organization, Role, Status, User } from "@prisma/client";
import type { Dict } from "@/i18n";
import {
  createOrg, updateOrg, createUser, updateUser, setUserStatus, resetPassword, type FormState,
} from "./actions";

const ROLES: Role[] = ["MANAGER", "DIRECTOR", "DEPUTY", "ACCOUNTANT", "SUPER_ADMIN"];
const GLOBAL: Role[] = ["SUPER_ADMIN", "ACCOUNTANT"];

function Message({ state, d }: { state: FormState; d: Dict }) {
  if (state.error) return <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{d[state.error]}</p>;
  if (state.ok && !state.newPassword) return <p className="text-sm text-accent">{d["common.saved"]}</p>;
  return null;
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      {children}
    </div>
  );
}

export function OrgForm({ d, org }: { d: Dict; org?: Organization }) {
  const action = org ? updateOrg.bind(null, org.id) : createOrg;
  const [state, formAction, pending] = useActionState(action, {});
  const v = state.values;
  return (
    <form key={JSON.stringify(v ?? org ?? null)} action={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field id="name" label={d["common.name"]}>
        <input id="name" name="name" required defaultValue={v?.name ?? org?.name} className="input" />
      </Field>
      <Field id="inn" label={d["org.inn"]}>
        <input id="inn" name="inn" defaultValue={v?.inn ?? org?.inn ?? ""} inputMode="numeric" className="input" />
      </Field>
      <Field id="org-phone" label={d["org.phone"]}>
        <input id="org-phone" name="phone" type="tel" defaultValue={v?.phone ?? org?.phone ?? ""} className="input" />
      </Field>
      <Field id="address" label={d["org.address"]}>
        <input id="address" name="address" defaultValue={v?.address ?? org?.address ?? ""} className="input" />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button className="btn" disabled={pending}>{org ? d["common.save"] : d["common.add"]}</button>
        <Message state={state} d={d} />
      </div>
    </form>
  );
}

type OrgOption = Pick<Organization, "id" | "name">;

export type EditableUser = Pick<User, "id" | "fullName" | "phone" | "role" | "orgId">;

export function UserForm({ d, orgs, user, defaultOrgId }: { d: Dict; orgs: OrgOption[]; user?: EditableUser; defaultOrgId?: string }) {
  const action = user ? updateUser.bind(null, user.id) : createUser;
  const [state, formAction, pending] = useActionState(action, {});
  const v = state.values;
  return (
    <form key={JSON.stringify(v ?? user ?? null)} action={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field id="fullName" label={d["user.fullName"]}>
        <input id="fullName" name="fullName" required defaultValue={v?.fullName ?? user?.fullName} className="input" />
      </Field>
      <Field id="user-phone" label={d["user.phone"]}>
        <input id="user-phone" name="phone" type="tel" required defaultValue={v?.phone ?? user?.phone} placeholder="+998 90 123 45 67" className="input" />
      </Field>
      <Field id="role" label={d["user.role"]}>
        <select id="role" name="role" defaultValue={v?.role ?? user?.role ?? "MANAGER"} className="input">
          {ROLES.map((r) => <option key={r} value={r}>{d[`role.${r}`]}</option>)}
        </select>
      </Field>
      <Field id="orgId" label={d["user.org"]}>
        <select id="orgId" name="orgId" defaultValue={v?.orgId ?? user?.orgId ?? defaultOrgId ?? ""} className="input">
          <option value="">— {d["user.orgNotNeeded"]} —</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <p className="mt-1 text-xs text-muted">{GLOBAL.map((r) => d[`role.${r}`]).join(", ")}: {d["user.orgNotNeeded"].toLowerCase()}</p>
      </Field>
      {!user && (
        <Field id="password" label={d["user.password"]}>
          <input id="password" name="password" type="text" required minLength={8} autoComplete="new-password" className="input" />
          <p className="mt-1 text-xs text-muted">{d["user.passwordHint"]}</p>
        </Field>
      )}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button className="btn" disabled={pending}>{user ? d["common.save"] : d["common.add"]}</button>
        <Message state={state} d={d} />
      </div>
    </form>
  );
}

export function UserControls({ d, id, status }: { d: Dict; id: string; status: Status }) {
  const [statusState, statusAction, statusPending] = useActionState(
    async () => setUserStatus(id, status === "ACTIVE" ? "BLOCKED" : "ACTIVE"),
    {} as FormState,
  );
  const [pwState, pwAction, pwPending] = useActionState(async () => resetPassword(id), {} as FormState);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-3">
        <form action={statusAction}>
          <button className={status === "ACTIVE" ? "btn-danger" : "btn-ghost"} disabled={statusPending}>
            {status === "ACTIVE" ? d["common.block"] : d["common.unblock"]}
          </button>
        </form>
        <form action={pwAction}>
          <button className="btn-ghost" disabled={pwPending}>{d["user.resetPassword"]}</button>
        </form>
      </div>
      {statusState.error && <Message state={statusState} d={d} />}
      {pwState.newPassword && (
        <div className="rounded-lg bg-warn-soft px-4 py-3 text-sm">
          <div>{d["user.newPassword"]}: <code className="select-all text-base font-semibold">{pwState.newPassword}</code></div>
          <div className="mt-1 text-warn">{d["user.newPasswordNote"]}</div>
        </div>
      )}
    </div>
  );
}
