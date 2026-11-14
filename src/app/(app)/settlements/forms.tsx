"use client";

import { useActionState, useState } from "react";
import type { Dict } from "@/i18n";
import type { FormState } from "@/lib/form";
import { crossRate, formatNumber, parseAmount, rateDigits, type RateMap } from "@/lib/currency-core";
import { autoAllocate, consumedFor, demurrage, methodAllowed, round2, type Method, type Terms } from "@/lib/settlement-core";
import { accountKindFor, type AccountKind } from "@/lib/cash-core";
import { addCharge, allocateAdvance, cancelCharge, cancelPayment, createPayment, handOverCash, ratesForDay, setPaymentAccount } from "./actions";

export type AccountOpt = { id: string; kind: AccountKind; currency: string; label: string };
export type PayAccounts = { options: AccountOpt[]; required: boolean };

export type OpenRow = { id: string; label: string; sub: string; currency: string; remaining: number; terms: Terms; order: number };

function Msg({ state, d, ok }: { state: FormState; d: Dict; ok?: string }) {
  if (state.error) return <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{d[state.error]}</p>;
  if (state.ok && ok) return <p className="text-sm text-accent">{ok}</p>;
  return null;
}

const fmt = (n: number, digits = 2) => formatNumber(n, digits);

/**
 * Taqsimlash bloki: kurs kataklari (1 yuk valyutasi = ? to'lov valyutasi), tashishlarni tanlash, avtomatik taqsimlash.
 * Natija yashirin "alloc" maydonida serverga yuboriladi; server hammasini qayta tekshiradi.
 */
function Allocator({ d, open, method, payCurrency, rates, amount }: {
  d: Dict; open: OpenRow[]; method: Method; payCurrency: string; rates: RateMap; amount: number | null;
}) {
  const visible = open.filter((r) => r.remaining > 0.005 && methodAllowed(method, r.terms));
  const foreign = [...new Set(visible.map((r) => r.currency).filter((c) => c !== payCurrency))];
  const [rateText, setRateText] = useState<Record<string, string>>({});
  const [manual, setManual] = useState<Record<string, boolean>>({});
  const [picked, setPicked] = useState<Record<string, string>>({});

  const rateFor = (c: string): number | null => {
    if (c === payCurrency) return 1;
    if (manual[c]) return parseAmount(rateText[c] ?? "");
    return crossRate(rates, c, payCurrency);
  };
  const shownRate = (c: string) => {
    if (manual[c]) return rateText[c] ?? "";
    const r = crossRate(rates, c, payCurrency);
    return r ? fmt(r, rateDigits(r)) : "";
  };

  const rows = visible
    .filter((r) => picked[r.id] !== undefined)
    .map((r) => ({ r, applied: parseAmount(picked[r.id]) ?? 0, rate: rateFor(r.currency) }));
  const total = round2(rows.reduce((s, x) => s + (x.rate ? consumedFor(x.applied, x.rate) : 0), 0));
  const advance = amount != null ? round2(amount - total) : null;
  const payload = JSON.stringify(rows.filter((x) => x.applied > 0 && x.rate).map((x) => ({
    shipmentId: x.r.id, applied: x.applied, rate: x.rate, manual: x.r.currency !== payCurrency && !!manual[x.r.currency],
  })));

  const auto = () => {
    if (!amount) return;
    const res = autoAllocate(amount, method, visible, rateFor);
    setPicked(Object.fromEntries(res.map((a) => [a.shipmentId, fmt(a.applied)])));
  };

  return (
    <div className="grid gap-3">
      <input type="hidden" name="alloc" value={payload} />
      {foreign.length > 0 && (
        <div className="grid gap-2 rounded-lg bg-accent-soft p-3">
          {foreign.map((c) => (
            <label key={c} className="flex flex-wrap items-center gap-2 text-sm">
              <span>{d["calc.rate"]}: 1 {c} =</span>
              <input
                aria-label={`${d["calc.rate"]} ${c}`} inputMode="decimal" value={shownRate(c)}
                onChange={(e) => { setRateText({ ...rateText, [c]: e.target.value }); setManual({ ...manual, [c]: true }); }}
                className={`input w-36 text-right font-semibold tabular-nums ${manual[c] ? "border-warn" : ""}`}
              />
              <span>{payCurrency}</span>
              {manual[c] ? (
                <button type="button" className="text-xs text-accent hover:underline" onClick={() => setManual({ ...manual, [c]: false })}>{d["calc.reset"]}</button>
              ) : (
                <span className="text-xs text-muted">{crossRate(rates, c, payCurrency) ? d["calc.cbu"] : d["calc.noRate"]}</span>
              )}
            </label>
          ))}
        </div>
      )}
      <fieldset className="grid gap-2">
        <legend className="label">{d["pay.forWhich"]}</legend>
        {visible.length === 0 && <p className="text-sm text-muted">{d["pay.noOpen"]}</p>}
        {visible.map((r) => {
          const on = picked[r.id] !== undefined;
          return (
            <div key={r.id} className={`flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 ${on ? "border-2 border-accent" : "border border-line"}`}>
              <label className="flex min-w-0 flex-1 items-center gap-2">
                <input type="checkbox" checked={on} onChange={(e) => {
                  const next = { ...picked };
                  if (e.target.checked) next[r.id] = fmt(r.remaining); else delete next[r.id];
                  setPicked(next);
                }} />
                <span className="min-w-0">
                  <span className="font-semibold">{r.label}</span> <span className="text-sm">{r.sub}</span>
                  <span className="block text-xs text-muted">{d["pay.debt"]}: {fmt(r.remaining)} {r.currency} · {d[`trip.terms.${r.terms}`]}</span>
                </span>
              </label>
              {on && (
                <span className="flex items-center gap-1">
                  <input aria-label={`${r.label} ${d["calc.amount"]}`} inputMode="decimal" value={picked[r.id]}
                    onChange={(e) => setPicked({ ...picked, [r.id]: e.target.value })}
                    className="input w-32 text-right tabular-nums" />
                  <span className="text-sm">{r.currency}</span>
                </span>
              )}
            </div>
          );
        })}
        {visible.length > 0 && (
          <button type="button" onClick={auto} disabled={!amount} className="min-h-11 rounded-lg border border-dashed border-line text-sm text-accent hover:bg-accent-soft disabled:opacity-50">
            {d["pay.auto"]}
          </button>
        )}
      </fieldset>
      <div className="grid gap-1 rounded-lg bg-ground p-3 text-sm">
        <div className="flex justify-between"><span>{d["pay.allocated"]}</span><strong className="tabular-nums">{fmt(total)} {payCurrency}</strong></div>
        {advance != null && (
          advance < -0.005
            ? <div className="text-bad">{d["pay.error.exceed"]}</div>
            : <div className="flex justify-between text-muted"><span>{d["pay.toAdvance"]}</span><span className="tabular-nums">{fmt(Math.max(0, advance))} {payCurrency}</span></div>
        )}
      </div>
    </div>
  );
}

export function PaymentForm({ d, clientId, open, currencies, drivers, rates: initialRates, today, accounts }: {
  d: Dict; clientId: string; open: OpenRow[]; currencies: string[]; drivers: { id: string; label: string }[]; rates: RateMap; today: string; accounts: PayAccounts;
}) {
  const [rates, setRates] = useState<RateMap>(initialRates);
  const [date, setDate] = useState(today);
  const [amountText, setAmountText] = useState("");
  const [saved, setSaved] = useState(0);
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await createPayment(clientId, prev, fd);
    if (r.ok) { setAmountText(""); setSaved((n) => n + 1); }
    return r;
  }, {});
  const firstCur = open.find((r) => r.remaining > 0)?.currency;
  const [currency, setCurrency] = useState(firstCur && currencies.includes(firstCur) ? firstCur : currencies.includes("USD") ? "USD" : currencies[0]);
  const hasContract = open.some((r) => r.terms === "CONTRACT" && r.remaining > 0);
  const [method, setMethod] = useState<Method>(hasContract || !open.length ? "BANK" : "CASH");
  const [receivedBy, setReceivedBy] = useState("OFFICE");
  const amount = parseAmount(amountText);
  // To'lov turi, valyuta, sana o'zgarsa yoki to'lov saqlansa — taqsimot qaytadan boshlanadi.
  const resetKey = `${method}|${currency}|${date}|${saved}`;

  return (
    <form action={action} className="grid gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="p-date" className="label">{d["pay.date"]}</label>
          <input id="p-date" name="date" type="date" required value={date} max={today}
            onChange={async (e) => { setDate(e.target.value); setRates(await ratesForDay(e.target.value)); }} className="input" />
        </div>
        <div>
          <label htmlFor="p-cur" className="label">{d["currency.code"]}</label>
          <select id="p-cur" name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className="input">
            {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label htmlFor="p-amount" className="label">{d["pay.amount"]}</label>
          <input id="p-amount" name="amount" inputMode="decimal" required value={amountText} onChange={(e) => setAmountText(e.target.value)}
            className="input text-lg font-semibold tabular-nums" />
        </div>
      </div>
      <fieldset>
        <legend className="label">{d["pay.method"]}</legend>
        <div className="grid grid-cols-3 gap-2">
          {(["BANK", "CASH", "CARD"] as const).map((m) => (
            <label key={m} className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm ${method === m ? "border-2 border-accent font-semibold" : "border border-line"}`}>
              <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} /> {d[`pay.m.${m}`]}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">{d["pay.methodHint"]}</p>
      </fieldset>
      {method === "CASH" && (
        <div className="grid gap-2">
          <label htmlFor="p-recv" className="label">{d["pay.receivedBy"]}</label>
          <select id="p-recv" name="receivedBy" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} className="input">
            <option value="OFFICE">{d["pay.r.OFFICE"]}</option>
            <option value="DRIVER">{d["pay.r.DRIVER"]}</option>
          </select>
          {receivedBy === "DRIVER" && (
            <select name="driverId" required aria-label={d["trip.driver"]} defaultValue="" className="input">
              <option value="" disabled>{d["trip.driver"]}</option>
              {drivers.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          )}
        </div>
      )}
      <AccountSelect d={d} accounts={accounts} kind={accountKindFor(method, method === "CASH" ? (receivedBy as "OFFICE" | "DRIVER") : null)} currency={currency} />
      <Allocator key={resetKey} d={d} open={open} method={method} payCurrency={currency} rates={rates} amount={amount} />
      <div>
        <label htmlFor="p-note" className="label">{d["common.note"]}</label>
        <input id="p-note" name="note" placeholder={d["pay.noteHint"]} className="input" />
      </div>
      <button className="btn min-h-12" disabled={pending}>{d["common.save"]}</button>
      <Msg state={state} d={d} ok={d["pay.saved"]} />
    </form>
  );
}

/** Avansni (to'lovning taqsimlanmagan qismini) qarzga yopish. */
export function AdvanceForm({ d, paymentId, open, method, currency, advance, rates }: {
  d: Dict; paymentId: string; open: OpenRow[]; method: Method; currency: string; advance: number; rates: RateMap;
}) {
  const [show, setShow] = useState(false);
  const [state, action, pending] = useActionState(allocateAdvance.bind(null, paymentId), {});
  if (!show) return <button type="button" className="btn-ghost" onClick={() => setShow(true)}>{d["pay.allocateAdvance"]}</button>;
  return (
    <form action={action} className="grid w-full gap-3 rounded-lg bg-paper p-3">
      <Allocator d={d} open={open} method={method} payCurrency={currency} rates={rates} amount={advance} />
      <div className="flex flex-wrap gap-2">
        <button className="btn" disabled={pending}>{d["common.save"]}</button>
        <button type="button" className="btn-ghost" onClick={() => setShow(false)}>{d["common.cancel"]}</button>
      </div>
      <Msg state={state} d={d} />
    </form>
  );
}

export function ChargeForm({ d, shipmentId, currency, today }: { d: Dict; shipmentId: string; currency: string; today: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"EXTRA" | "DEMURRAGE">("EXTRA");
  const [days, setDays] = useState("");
  const [daily, setDaily] = useState("");
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await addCharge(shipmentId, prev, fd);
    if (r.ok) setOpen(false);
    return r;
  }, {});
  if (!open) return <button type="button" className="btn-ghost" onClick={() => setOpen(true)}>+ {d["pay.addCharge"]}</button>;
  const total = Number(days) > 0 && parseAmount(daily) ? demurrage(Number(days), parseAmount(daily)!) : null;
  return (
    <form action={action} className="grid gap-3 rounded-lg bg-ground p-3">
      <div className="grid grid-cols-2 gap-2">
        {(["EXTRA", "DEMURRAGE"] as const).map((k) => (
          <label key={k} className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-paper text-sm ${kind === k ? "border-2 border-accent font-semibold" : "border border-line"}`}>
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} /> {d[`pay.c.${k}`]}
          </label>
        ))}
      </div>
      {kind === "EXTRA" ? (
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <div>
            <label htmlFor={`ch-a-${shipmentId}`} className="label">{d["pay.amount"]}</label>
            <input id={`ch-a-${shipmentId}`} name="amount" inputMode="decimal" required className="input tabular-nums" />
          </div>
          <span className="pb-3 text-sm">{currency}</span>
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <div>
            <label htmlFor={`ch-d-${shipmentId}`} className="label">{d["pay.days"]}</label>
            <input id={`ch-d-${shipmentId}`} name="days" inputMode="numeric" required value={days} onChange={(e) => setDays(e.target.value)} className="input tabular-nums" />
          </div>
          <div>
            <label htmlFor={`ch-p-${shipmentId}`} className="label">{d["pay.daily"]}</label>
            <input id={`ch-p-${shipmentId}`} name="dailyAmount" inputMode="decimal" required value={daily} onChange={(e) => setDaily(e.target.value)} className="input tabular-nums" />
          </div>
          <span className="pb-3 text-sm">{currency}</span>
          {total != null && <p className="col-span-3 text-sm">{d["pay.c.DEMURRAGE"]}: {days} × {daily} = <strong className="tabular-nums">{fmt(total)} {currency}</strong></p>}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <input name="description" aria-label={d["common.note"]} placeholder={d["common.note"]} className="input" />
        <input name="date" type="date" required defaultValue={today} max={today} aria-label={d["pay.date"]} className="input" />
      </div>
      <div className="flex gap-2">
        <button className="btn" disabled={pending}>{d["common.save"]}</button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>{d["common.cancel"]}</button>
      </div>
      <Msg state={state} d={d} />
    </form>
  );
}

function ConfirmButton({ label, confirm, run, className = "text-sm text-muted hover:underline" }: {
  label: string; confirm?: string; run: () => Promise<FormState>; className?: string;
}) {
  const [, action, pending] = useActionState(async () => run(), {} as FormState);
  return (
    <form action={action} className="inline" onSubmit={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}>
      <button className={className} disabled={pending}>{label}</button>
    </form>
  );
}

export function CancelPaymentButton({ d, paymentId }: { d: Dict; paymentId: string }) {
  return <ConfirmButton label={d["pay.cancel"]} confirm={d["pay.cancelConfirm"]} run={() => cancelPayment(paymentId)} />;
}

export function CancelChargeButton({ d, chargeId }: { d: Dict; chargeId: string }) {
  return <ConfirmButton label={d["pay.cancel"]} confirm={d["pay.cancelChargeConfirm"]} run={() => cancelCharge(chargeId)} />;
}

/**
 * Tushum qaysi hisobga tushdi: faqat to'lov turiga (bank/kassa/karta) va valyutasiga mos hisoblar ko'rsatiladi.
 * Haydovchidagi naqd uchun (kind = null) hisob tanlanmaydi — topshirilganda tanlanadi.
 */
function AccountSelect({ d, accounts, kind, currency, id = "p-acc" }: { d: Dict; accounts: PayAccounts; kind: AccountKind | null; currency: string; id?: string }) {
  if (!kind || (!accounts.required && accounts.options.length === 0)) return null;
  const fit = accounts.options.filter((a) => a.kind === kind && a.currency === currency);
  return (
    <div>
      <label htmlFor={id} className="label">{d["pay.account"]}</label>
      {fit.length === 0 ? (
        <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{d["pay.noAccount"]}</p>
      ) : (
        <select key={`${kind}|${currency}`} id={id} name="accountId" required={accounts.required} defaultValue={fit.length === 1 ? fit[0].id : ""} className="input">
          {(fit.length > 1 || !accounts.required) && <option value="">{accounts.required ? d["pay.pickAccount"] : d["pay.accountNone"]}</option>}
          {fit.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
      )}
    </div>
  );
}

/** Haydovchi naqd pulni kassaga topshirdi: qaysi naqd kassaga kirim qilinadi. */
export function HandOverButton({ d, paymentId, currency, accounts }: { d: Dict; paymentId: string; currency: string; accounts: PayAccounts }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(handOverCash.bind(null, paymentId), {});
  const needsPick = accounts.options.some((a) => a.kind === "CASH" && a.currency === currency) || accounts.required;
  if (!needsPick) {
    return (
      <form action={action} className="inline">
        <button className="btn-ghost" disabled={pending}>{d["pay.handOver"]}</button>
        <Msg state={state} d={d} />
      </form>
    );
  }
  if (!open) return <button type="button" className="btn-ghost" onClick={() => setOpen(true)}>{d["pay.handOver"]}</button>;
  return (
    <form action={action} className="grid w-full max-w-sm gap-2 rounded-lg bg-ground p-3">
      <AccountSelect d={d} accounts={accounts} kind="CASH" currency={currency} id={`ho-${paymentId}`} />
      <div className="flex gap-2">
        <button className="btn" disabled={pending}>{d["pay.handOver"]}</button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>{d["common.cancel"]}</button>
      </div>
      <Msg state={state} d={d} />
    </form>
  );
}

/** Mavjud to'lovning tushum hisobini ko'rsatish yoki tuzatish. */
export function PaymentAccountForm({ d, paymentId, kind, currency, current, accounts }: {
  d: Dict; paymentId: string; kind: AccountKind; currency: string; current: string | null; accounts: PayAccounts;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await setPaymentAccount(paymentId, prev, fd);
    if (r.ok) setOpen(false);
    return r;
  }, {});
  const fit = accounts.options.filter((a) => a.kind === kind && a.currency === currency);
  if (fit.length === 0) return null;
  if (!open) return <button type="button" className="text-sm text-accent hover:underline" onClick={() => setOpen(true)}>{current ? d["pay.changeAccount"] : d["pay.setAccount"]}</button>;
  return (
    <form action={action} className="flex w-full flex-wrap items-center gap-2 rounded-lg bg-ground p-2">
      <select name="accountId" aria-label={d["pay.account"]} defaultValue={current ?? ""} className="input w-auto min-w-0 flex-1">
        {!accounts.required && <option value="">{d["pay.accountNone"]}</option>}
        {fit.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
      </select>
      <button className="btn" disabled={pending}>{d["common.save"]}</button>
      <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>{d["common.cancel"]}</button>
      <Msg state={state} d={d} />
    </form>
  );
}
