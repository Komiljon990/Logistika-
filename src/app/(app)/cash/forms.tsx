"use client";

import { useActionState, useState } from "react";
import type { Dict } from "@/i18n";
import type { FormState } from "@/lib/form";
import { formatNumber, parseAmount, rateDigits, type RateMap } from "@/lib/currency-core";
import { cbuTransferRate, convertTransfer, rateBaseFor, type AccountKind } from "@/lib/cash-core";
import type { CategoryTree } from "@/lib/cash";
import { ratesForDay } from "../settlements/actions";
import {
  addCategory, cancelEntry, cancelExpense, cancelExpenseAndBack, cancelTransfer, createAccount, createEntry, createExpense, createTransfer,
  renameCategory, setAccountStatus, setCashEnabled, setCategoryStatus, updateAccount, updateExpense,
} from "./actions";

export type AccountOpt = { id: string; kind: AccountKind; currency: string; label: string };

function Msg({ state, d, ok }: { state: FormState; d: Dict; ok?: string }) {
  if (state.error) return <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{d[state.error]}</p>;
  if (state.ok && ok) return <p role="status" className="text-sm text-accent">{ok}</p>;
  return null;
}

function OrgField({ orgId }: { orgId: string | null }) {
  return orgId ? <input type="hidden" name="orgId" value={orgId} /> : null;
}

/** Tasdiqlab bajariladigan kichik amal (o'chirish, nofaol qilish). */
export function ConfirmAction({ label, confirm, run, className = "text-sm text-muted hover:underline" }: {
  label: string; confirm?: string; run: () => Promise<unknown>; className?: string;
}) {
  const [, action, pending] = useActionState(async () => { await run(); return {}; }, {});
  return (
    <form action={action} className="inline" onSubmit={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}>
      <button className={className} disabled={pending}>{label}</button>
    </form>
  );
}

// ---------- Hisob (bank / kassa / karta) ----------

export type AccountValues = {
  id: string; kind: AccountKind; name: string; mfo: string; accountNumber: string; cardNumber: string; cardHolder: string;
  currency: string; openingBalance: string; note: string; untracked: boolean;
};

export function AccountForm({ d, currencies, orgField, account }: { d: Dict; currencies: string[]; orgField: string | null; account?: AccountValues }) {
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? "BANK");
  const [saved, setSaved] = useState(0);
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = account ? await updateAccount(account.id, prev, fd) : await createAccount(prev, fd);
    // Yangi hisob saqlangach forma tozalanadi (key o'zgaradi).
    if (r.ok && !account) setSaved((n) => n + 1);
    return r;
  }, {});
  const v = (k: Exclude<keyof AccountValues, "untracked">) => state.values?.[k] ?? account?.[k] ?? "";
  const untracked = state.values ? state.values.untracked === "on" : !!account?.untracked;
  return (
    <form key={saved} action={action} className="grid gap-4">
      <OrgField orgId={orgField} />
      <fieldset>
        <legend className="label">{d["cash.kind"]}</legend>
        <div className="grid grid-cols-3 gap-2">
          {(["BANK", "CASH", "CARD"] as const).map((k) => (
            <label key={k} className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm ${kind === k ? "border-2 border-accent font-semibold" : "border border-line"}`}>
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} /> {d[`cash.k.${k}`]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="a-name" className="label">{d[`cash.name.${kind}`]}</label>
          <input id="a-name" name="name" required maxLength={100} defaultValue={v("name")} placeholder={d[`cash.namePh.${kind}`]} className="input" />
        </div>
        {kind === "BANK" && (
          <>
            <div>
              <label htmlFor="a-mfo" className="label">{d["cash.mfo"]}</label>
              <input id="a-mfo" name="mfo" required inputMode="numeric" maxLength={5} defaultValue={v("mfo")} placeholder="00000" className="input tabular-nums" />
            </div>
            <div>
              <label htmlFor="a-num" className="label">{d["cash.accountNumber"]}</label>
              <input id="a-num" name="accountNumber" required inputMode="numeric" maxLength={24} defaultValue={v("accountNumber")} placeholder="20208000…" className="input tabular-nums" />
            </div>
          </>
        )}
        {kind === "CARD" && (
          <>
            <div>
              <label htmlFor="a-card" className="label">{d["cash.cardNumber"]}</label>
              <input id="a-card" name="cardNumber" required inputMode="numeric" maxLength={23} defaultValue={v("cardNumber")} placeholder="8600 0000 0000 0000" className="input tabular-nums" />
            </div>
            <div>
              <label htmlFor="a-holder" className="label">{d["cash.cardHolder"]}</label>
              <input id="a-holder" name="cardHolder" required maxLength={100} defaultValue={v("cardHolder")} placeholder={d["cash.cardHolderPh"]} className="input" />
            </div>
          </>
        )}
        <div>
          <label htmlFor="a-cur" className="label">{d["currency.code"]}</label>
          <select id="a-cur" name="currency" defaultValue={v("currency") || (currencies.includes("UZS") ? "UZS" : currencies[0])} className="input">
            {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="a-open" className="label">{d["cash.openingBalance"]}</label>
          <input id="a-open" name="openingBalance" inputMode="decimal" defaultValue={v("openingBalance")} placeholder="0" className="input text-right tabular-nums" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="a-note" className="label">{d["common.note"]}</label>
          <input id="a-note" name="note" maxLength={300} defaultValue={v("note")} className="input" />
        </div>
      </div>
      <p className="text-xs text-muted">{d["cash.openingHint"]}</p>
      <label className="flex items-start gap-2 rounded-lg border border-line p-3 text-sm">
        <input type="checkbox" name="untracked" defaultChecked={untracked} className="mt-1" />
        <span>
          <span className="font-semibold">{d["cash.untracked"]}</span>
          <span className="block text-xs text-muted">{d["cash.untrackedHint"]}</span>
        </span>
      </label>
      <button className="btn min-h-11" disabled={pending}>{d["common.save"]}</button>
      <Msg state={state} d={d} ok={d["common.saved"]} />
    </form>
  );
}

export function AccountStatusButton({ d, id, active }: { d: Dict; id: string; active: boolean }) {
  return (
    <ConfirmAction
      label={active ? d["veh.deactivate"] : d["common.restore"]}
      confirm={active ? d["cash.archiveConfirm"] : undefined}
      className={active ? "btn-ghost" : "btn"}
      run={() => setAccountStatus(id, active ? "ARCHIVED" : "ACTIVE")}
    />
  );
}

// ---------- Xarajat ----------

export type ExpenseValues = { id: string; date: string; accountId: string; amount: string; parentId: string; categoryId: string; note: string; tripId?: string };

export function ExpenseForm({ d, accounts, categories, orgField, today, expense, trips = [], tripId = "" }: {
  d: Dict; accounts: AccountOpt[]; categories: CategoryTree; orgField: string | null; today: string; expense?: ExpenseValues; tripId?: string;
  /** 18.11.2026: xarajat qaysi reysga tegishli (ixtiyoriy) — reys rentabelligi hisoboti uchun. */
  trips?: { id: string; label: string }[];
}) {
  const [parent, setParent] = useState(expense?.parentId ?? "");
  const [sub, setSub] = useState(expense?.categoryId && expense.categoryId !== expense.parentId ? expense.categoryId : "");
  const [accountId, setAccountId] = useState(expense?.accountId ?? (accounts.length === 1 ? accounts[0].id : ""));
  const [saved, setSaved] = useState(0);
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = expense ? await updateExpense(expense.id, prev, fd) : await createExpense(prev, fd);
    if (r.ok && !expense) { setSaved((n) => n + 1); setParent(""); setSub(""); }
    return r;
  }, {});
  const children = categories.find((c) => c.id === parent)?.children ?? [];
  const cur = accounts.find((a) => a.id === accountId)?.currency ?? "";
  const categoryId = children.length ? sub : parent;
  if (accounts.length === 0) return <p className="text-sm text-muted">{d["cash.noAccounts"]}</p>;
  return (
    <form key={saved} action={action} className="grid gap-3">
      <OrgField orgId={orgField} />
      <input type="hidden" name="categoryId" value={categoryId} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label htmlFor="e-cat" className="label">{d["cash.category"]}</label>
          <select id="e-cat" required value={parent} onChange={(e) => { setParent(e.target.value); setSub(""); }} className="input">
            <option value="" disabled>{d["cash.pickCategory"]}</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="e-sub" className="label">{d["cash.subcategory"]}</label>
          <select id="e-sub" required={children.length > 0} disabled={children.length === 0} value={sub} onChange={(e) => setSub(e.target.value)} className="input">
            <option value="" disabled>{children.length ? d["cash.pickSubcategory"] : "—"}</option>
            {children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="e-acc" className="label">{d["cash.fromAccount"]}</label>
          <select id="e-acc" name="accountId" required value={accountId} onChange={(e) => setAccountId(e.target.value)} className="input">
            <option value="" disabled>{d["pay.pickAccount"]}</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="e-amount" className="label">{d["cash.amount"]}{cur ? `, ${cur}` : ""}</label>
          <input id="e-amount" name="amount" required inputMode="decimal" defaultValue={state.values?.amount ?? expense?.amount ?? ""} className="input text-lg font-semibold tabular-nums" />
        </div>
        <div>
          <label htmlFor="e-date" className="label">{d["pay.date"]}</label>
          <input id="e-date" name="date" type="date" required max={today} defaultValue={state.values?.date ?? expense?.date ?? today} className="input" />
        </div>
        {trips.length > 0 && (
          <div>
            <label htmlFor="e-trip" className="label">{d["cash.expenseTrip"]}</label>
            <select id="e-trip" name="tripId" defaultValue={state.values?.tripId ?? expense?.tripId ?? tripId} className="input">
              <option value="">— {d["cash.expenseNoTrip"]}</option>
              {trips.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </div>
        )}
        <div className="sm:col-span-2">
          <label htmlFor="e-note" className="label">{d["common.note"]}</label>
          <input id="e-note" name="note" maxLength={300} defaultValue={state.values?.note ?? expense?.note ?? ""} placeholder={d["cash.expenseNotePh"]} className="input" />
        </div>
      </div>
      <button className="btn min-h-11" disabled={pending}>{d["common.save"]}</button>
      <Msg state={state} d={d} ok={expense ? d["common.saved"] : d["cash.expenseSaved"]} />
    </form>
  );
}

export function CancelExpenseButton({ d, id, back }: { d: Dict; id: string; back?: boolean }) {
  return <ConfirmAction label={d["common.delete"]} confirm={d["cash.deleteConfirm"]} className={back ? "btn-ghost text-bad" : undefined} run={() => (back ? cancelExpenseAndBack(id) : cancelExpense(id))} />;
}

// ---------- O'tkazma ----------

export function TransferForm({ d, accounts, rates: initialRates, today, orgField }: {
  d: Dict; accounts: AccountOpt[]; rates: RateMap; today: string; orgField: string | null;
}) {
  const [rates, setRates] = useState(initialRates);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amountText, setAmountText] = useState("");
  const [rateText, setRateText] = useState("");
  const [manual, setManual] = useState(false);
  const [saved, setSaved] = useState(0);
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await createTransfer(prev, fd);
    if (r.ok) { setSaved((n) => n + 1); setAmountText(""); setManual(false); }
    return r;
  }, {});
  const from = accounts.find((a) => a.id === fromId);
  const to = accounts.find((a) => a.id === toId);
  const cross = !!from && !!to && from.currency !== to.currency;
  const base = cross ? rateBaseFor(rates, from.currency, to.currency) : "";
  const other = cross ? (base === from.currency ? to.currency : from.currency) : "";
  const cbu = cross ? cbuTransferRate(rates, from.currency, to.currency, base) : null;
  const rate = manual ? parseAmount(rateText) : cbu;
  const amount = parseAmount(amountText);
  const received = from && to && amount ? (cross ? (rate ? convertTransfer(amount, from.currency, to.currency, rate, base) : null) : amount) : null;
  return (
    <form key={saved} action={action} className="grid gap-3">
      <OrgField orgId={orgField} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="t-from" className="label">{d["cash.transferFrom"]}</label>
          <select id="t-from" name="fromAccountId" required value={fromId} onChange={(e) => { setFromId(e.target.value); setManual(false); }} className="input">
            <option value="" disabled>{d["pay.pickAccount"]}</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="t-to" className="label">{d["cash.transferTo"]}</label>
          <select id="t-to" name="toAccountId" required value={toId} onChange={(e) => { setToId(e.target.value); setManual(false); }} className="input">
            <option value="" disabled>{d["pay.pickAccount"]}</option>
            {accounts.filter((a) => a.id !== fromId).map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="t-amount" className="label">{d["cash.transferAmount"]}{from ? `, ${from.currency}` : ""}</label>
          <input id="t-amount" name="amount" required inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} className="input text-lg font-semibold tabular-nums" />
        </div>
        <div>
          <label htmlFor="t-date" className="label">{d["pay.date"]}</label>
          <input id="t-date" name="date" type="date" required max={today} defaultValue={today}
            onChange={async (e) => setRates(await ratesForDay(e.target.value))} className="input" />
        </div>
      </div>
      {cross && (
        <div className="grid gap-2 rounded-lg bg-accent-soft p-3">
          <input type="hidden" name="rateBase" value={base} />
          <input type="hidden" name="rateManual" value={manual ? "1" : "0"} />
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <span>{d["calc.rate"]}: 1 {base} =</span>
            <input name="rate" aria-label={`${d["calc.rate"]} ${base}`} inputMode="decimal" required
              value={manual ? rateText : cbu ? formatNumber(cbu, rateDigits(cbu)) : ""}
              onChange={(e) => { setRateText(e.target.value); setManual(true); }}
              className={`input w-36 text-right font-semibold tabular-nums ${manual ? "border-warn" : ""}`} />
            <span>{other}</span>
            {manual ? (
              <button type="button" className="text-xs text-accent hover:underline" onClick={() => setManual(false)}>{d["calc.reset"]}</button>
            ) : (
              <span className="text-xs text-muted">{cbu ? d["calc.cbu"] : d["calc.noRate"]}</span>
            )}
          </label>
        </div>
      )}
      {received != null && to && (
        <div className="flex justify-between rounded-lg bg-ground p-3 text-sm">
          <span>{d["cash.received"]}</span>
          <strong className="tabular-nums">{formatNumber(received)} {to.currency}</strong>
        </div>
      )}
      <div>
        <label htmlFor="t-note" className="label">{d["common.note"]}</label>
        <input id="t-note" name="note" maxLength={300} className="input" />
      </div>
      <button className="btn min-h-11" disabled={pending}>{d["common.save"]}</button>
      <Msg state={state} d={d} ok={d["cash.transferSaved"]} />
    </form>
  );
}

export function CancelTransferButton({ d, id }: { d: Dict; id: string }) {
  return <ConfirmAction label={d["common.delete"]} confirm={d["cash.deleteConfirm"]} run={() => cancelTransfer(id)} />;
}

// ---------- Boshqa kirim / chiqim ----------

export function EntryForm({ d, accounts, today, orgField }: { d: Dict; accounts: AccountOpt[]; today: string; orgField: string | null }) {
  const [direction, setDirection] = useState<"IN" | "OUT">("IN");
  const [accountId, setAccountId] = useState(accounts.length === 1 ? accounts[0].id : "");
  const [saved, setSaved] = useState(0);
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await createEntry(prev, fd);
    if (r.ok) setSaved((n) => n + 1);
    return r;
  }, {});
  const cur = accounts.find((a) => a.id === accountId)?.currency ?? "";
  if (accounts.length === 0) return <p className="text-sm text-muted">{d["cash.noAccounts"]}</p>;
  return (
    <form key={saved} action={action} className="grid gap-3">
      <OrgField orgId={orgField} />
      <fieldset>
        <legend className="label">{d["cash.entryDirection"]}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["IN", "OUT"] as const).map((k) => (
            <label key={k} className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm ${direction === k ? `border-2 font-semibold ${k === "IN" ? "border-accent text-accent" : "border-bad text-bad"}` : "border border-line"}`}>
              <input type="radio" name="direction" value={k} checked={direction === k} onChange={() => setDirection(k)} /> {d[`cash.entry.${k}`]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="x-party" className="label">{direction === "IN" ? d["cash.partyFrom"] : d["cash.partyTo"]}</label>
          <input id="x-party" name="party" required maxLength={200} defaultValue={state.values?.party} placeholder={d["cash.partyPh"]} className="input" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="x-acc" className="label">{direction === "IN" ? d["cash.toAccount"] : d["cash.fromAccount"]}</label>
          <select id="x-acc" name="accountId" required value={accountId} onChange={(e) => setAccountId(e.target.value)} className="input">
            <option value="" disabled>{d["pay.pickAccount"]}</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="x-amount" className="label">{d["cash.amount"]}{cur ? `, ${cur}` : ""}</label>
          <input id="x-amount" name="amount" required inputMode="decimal" defaultValue={state.values?.amount} className="input text-lg font-semibold tabular-nums" />
        </div>
        <div>
          <label htmlFor="x-date" className="label">{d["pay.date"]}</label>
          <input id="x-date" name="date" type="date" required max={today} defaultValue={state.values?.date ?? today} className="input" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="x-note" className="label">{d["common.note"]}</label>
          <input id="x-note" name="note" maxLength={300} defaultValue={state.values?.note} placeholder={d["cash.entryNotePh"]} className="input" />
        </div>
      </div>
      <button className="btn min-h-11" disabled={pending}>{d["common.save"]}</button>
      <Msg state={state} d={d} ok={d["cash.entrySaved"]} />
    </form>
  );
}

export function CancelEntryButton({ d, id }: { d: Dict; id: string }) {
  return <ConfirmAction label={d["common.delete"]} confirm={d["cash.deleteConfirm"]} run={() => cancelEntry(id)} />;
}

// ---------- Sozlamalar: bo'limni yoqish, turkumlar ----------

export function CashToggle({ d, enabled }: { d: Dict; enabled: boolean }) {
  return (
    <ConfirmAction
      label={enabled ? d["cash.turnOff"] : d["cash.turnOn"]}
      confirm={enabled ? d["cash.turnOffConfirm"] : undefined}
      className={enabled ? "btn-ghost" : "btn"}
      run={() => setCashEnabled(!enabled)}
    />
  );
}

export function AddCategoryForm({ d, parentId, placeholder }: { d: Dict; parentId: string | null; placeholder: string }) {
  const [saved, setSaved] = useState(0);
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await addCategory(parentId, prev, fd);
    if (r.ok) setSaved((n) => n + 1);
    return r;
  }, {});
  return (
    <form key={saved} action={action} className="grid gap-1">
      <div className="flex gap-2">
        <input name="name" required maxLength={80} aria-label={placeholder} placeholder={placeholder} defaultValue={state.values?.name} className="input min-w-0 flex-1" />
        <button className="btn-ghost" disabled={pending}>+ {d["common.add"]}</button>
      </div>
      <Msg state={state} d={d} />
    </form>
  );
}

export function CategoryRow({ d, id, name, active, strong }: { d: Dict; id: string; name: string; active: boolean; strong?: boolean }) {
  const [edit, setEdit] = useState(false);
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await renameCategory(id, prev, fd);
    if (r.ok) setEdit(false);
    return r;
  }, {});
  if (edit) {
    return (
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input name="name" required maxLength={80} defaultValue={name} aria-label={d["common.name"]} className="input min-w-0 flex-1" />
        <button className="btn" disabled={pending}>{d["common.save"]}</button>
        <button type="button" className="btn-ghost" onClick={() => setEdit(false)}>{d["common.cancel"]}</button>
        <Msg state={state} d={d} />
      </form>
    );
  }
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${active ? "" : "text-muted line-through"}`}>
      <span className={strong ? "font-semibold" : ""}>{name}</span>
      <span className="flex-1" />
      {active && <button type="button" className="text-sm text-accent hover:underline" onClick={() => setEdit(true)}>{d["common.edit"]}</button>}
      <ConfirmAction
        label={active ? d["veh.deactivate"] : d["common.restore"]}
        className="text-sm text-muted no-underline hover:underline"
        run={() => setCategoryStatus(id, active ? "ARCHIVED" : "ACTIVE")}
      />
    </div>
  );
}
