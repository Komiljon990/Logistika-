"use client";

import { useActionState, useState } from "react";
import type { DocType, DriverCategory, Ownership, VehicleType } from "@prisma/client";
import type { Dict } from "@/i18n";
import type { FormState } from "@/lib/form";
import { createVehicle, updateVehicle, createDriver, updateDriver, addDocument } from "./fleet-actions";

function Message({ state, d }: { state: FormState; d: Dict }) {
  if (state.error) return <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{d[state.error]}</p>;
  if (state.ok) return <p className="text-sm text-accent">{d["common.saved"]}</p>;
  return null;
}

function Field({ id, label, children, wide }: { id: string; label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <label htmlFor={id} className="label">{label}</label>
      {children}
    </div>
  );
}

type Option = { id: string; label: string };

export type VehicleValues = {
  id: string; plate: string; model: string; type: VehicleType; ownership: Ownership;
  leaseOwner: string; leaseStart: string; leaseEnd: string; note: string;
  pairTrailerId: string; pairDriverId: string;
};

export function VehicleForm({ d, vehicle, trailers = [], drivers = [], readOnly = false }: {
  d: Dict; vehicle?: VehicleValues; trailers?: Option[]; drivers?: Option[]; readOnly?: boolean;
}) {
  const action = vehicle ? updateVehicle.bind(null, vehicle.id) : createVehicle;
  const [state, formAction, pending] = useActionState(action, {});
  const v = state.values;
  const [type, setType] = useState<string>(v?.type ?? vehicle?.type ?? "TRACTOR");
  const [ownership, setOwnership] = useState<string>(v?.ownership ?? vehicle?.ownership ?? "OWNED");
  const val = (k: keyof VehicleValues) => v?.[k] ?? vehicle?.[k] ?? "";
  // React 19 forma saqlangandan keyin maydonlarni boshlang'ich qiymatga qaytaradi; yangi ma'lumot kelganda
  // forma qayta yaratiladi, shunda saqlangan qiymatlar ko'rinib turadi.
  return (
    <form key={JSON.stringify(v ?? vehicle ?? null)} action={formAction}>
      <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2">
        <Field id="plate" label={d["veh.plate"]}>
          <input id="plate" name="plate" required defaultValue={val("plate")} placeholder="01 A 777 AA" className="input uppercase" />
        </Field>
        <Field id="model" label={d["veh.model"]}>
          <input id="model" name="model" defaultValue={val("model")} className="input" />
        </Field>
        <Field id="type" label={d["veh.type"]}>
          <select id="type" name="type" value={type} onChange={(e) => setType(e.target.value)} className="input">
            {(["TRACTOR", "TRAILER", "TRAIN", "OTHER"] as const).map((x) => <option key={x} value={x}>{d[`veh.type.${x}`]}</option>)}
          </select>
        </Field>
        <Field id="ownership" label={d["veh.ownership"]}>
          <select id="ownership" name="ownership" value={ownership} onChange={(e) => setOwnership(e.target.value)} className="input">
            {(["OWNED", "LEASED"] as const).map((x) => <option key={x} value={x}>{d[`veh.own.${x}`]}</option>)}
          </select>
        </Field>
        {ownership === "LEASED" && (
          <>
            <Field id="leaseOwner" label={d["veh.leaseOwner"]} wide>
              <input id="leaseOwner" name="leaseOwner" defaultValue={val("leaseOwner")} className="input" />
            </Field>
            <Field id="leaseStart" label={d["veh.leaseStart"]}>
              <input id="leaseStart" name="leaseStart" type="date" defaultValue={val("leaseStart")} className="input" />
            </Field>
            <Field id="leaseEnd" label={d["veh.leaseEnd"]}>
              <input id="leaseEnd" name="leaseEnd" type="date" defaultValue={val("leaseEnd")} className="input" />
            </Field>
          </>
        )}
        {vehicle && type === "TRACTOR" && (
          <div className="grid gap-4 rounded-lg bg-ground p-4 sm:col-span-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <div className="font-semibold">{d["veh.pair"]}</div>
              <p className="text-xs text-muted">{d["veh.pairHint"]}</p>
            </div>
            <Field id="pairTrailerId" label={d["veh.pairTrailer"]}>
              <select id="pairTrailerId" name="pairTrailerId" defaultValue={val("pairTrailerId")} className="input">
                <option value="">—</option>
                {trailers.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </Field>
            <Field id="pairDriverId" label={d["veh.pairDriver"]}>
              <select id="pairDriverId" name="pairDriverId" defaultValue={val("pairDriverId")} className="input">
                <option value="">—</option>
                {drivers.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </Field>
          </div>
        )}
        <Field id="note" label={d["common.note"]} wide>
          <textarea id="note" name="note" rows={2} defaultValue={val("note")} className="input" />
        </Field>
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button className="btn" disabled={pending}>{vehicle ? d["common.save"] : d["common.add"]}</button>
            <Message state={state} d={d} />
          </div>
        )}
      </fieldset>
    </form>
  );
}

export type DriverValues = { id: string; fullName: string; phone: string; category: DriverCategory; note: string };

export function DriverForm({ d, driver, readOnly = false }: { d: Dict; driver?: DriverValues; readOnly?: boolean }) {
  const action = driver ? updateDriver.bind(null, driver.id) : createDriver;
  const [state, formAction, pending] = useActionState(action, {});
  const v = state.values;
  const val = (k: keyof DriverValues) => v?.[k] ?? driver?.[k] ?? "";
  return (
    <form key={JSON.stringify(v ?? driver ?? null)} action={formAction}>
      <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2">
        <Field id="fullName" label={d["drv.fullName"]}>
          <input id="fullName" name="fullName" required defaultValue={val("fullName")} className="input" />
        </Field>
        <Field id="drv-phone" label={d["drv.phone"]}>
          <input id="drv-phone" name="phone" type="tel" defaultValue={val("phone")} placeholder="+998 90 123 45 67" className="input" />
        </Field>
        <Field id="category" label={d["drv.category"]}>
          <select id="category" name="category" defaultValue={val("category") || "EMPLOYEE"} className="input">
            {(["EMPLOYEE", "OWNER_OPERATOR"] as const).map((x) => <option key={x} value={x}>{d[`drv.cat.${x}`]}</option>)}
          </select>
        </Field>
        <Field id="drv-note" label={d["common.note"]}>
          <input id="drv-note" name="note" defaultValue={val("note")} className="input" />
        </Field>
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button className="btn" disabled={pending}>{driver ? d["common.save"] : d["common.add"]}</button>
            <Message state={state} d={d} />
          </div>
        )}
      </fieldset>
    </form>
  );
}

/** Yangi hujjat yoki mavjud hujjatning yangi versiyasi (renewOf). */
export function DocForm({ d, owner, types, fileRequired, renewOf, onDone }: {
  d: Dict;
  owner: { kind: "vehicle" | "driver"; id: string };
  types: DocType[];
  fileRequired: DocType[];
  renewOf?: { id: string; type: DocType };
  onDone?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    async (prev: FormState, fd: FormData) => {
      const res = await addDocument(owner, renewOf?.id ?? null, prev, fd);
      if (res.ok) onDone?.();
      return res;
    },
    {},
  );
  const v = state.values;
  const [type, setType] = useState<DocType>((v?.type as DocType) ?? renewOf?.type ?? types[0]);
  const required = fileRequired.includes(type);
  return (
    <form key={state.ok ? "done" : JSON.stringify(v)} action={formAction} className="grid gap-4 sm:grid-cols-2">
      {renewOf ? (
        <p className="text-sm text-muted sm:col-span-2">{d[`doc.t.${renewOf.type}`]}: {d["doc.renewHint"]}</p>
      ) : (
        <Field id="doc-type" label={d["doc.type"]}>
          <select id="doc-type" name="type" value={type} onChange={(e) => setType(e.target.value as DocType)} className="input">
            {types.map((x) => <option key={x} value={x}>{d[`doc.t.${x}`]}</option>)}
          </select>
        </Field>
      )}
      <Field id="doc-number" label={d["doc.number"]}>
        <input id="doc-number" name="number" defaultValue={v?.number} className="input" />
      </Field>
      <Field id="doc-issued" label={d["doc.issuedAt"]}>
        <input id="doc-issued" name="issuedAt" type="date" defaultValue={v?.issuedAt} className="input" />
      </Field>
      <Field id="doc-expires" label={d["doc.expiresAt"]}>
        <input id="doc-expires" name="expiresAt" type="date" defaultValue={v?.expiresAt} className="input" />
      </Field>
      <Field id="doc-file" label={d["doc.file"]} wide>
        <input id="doc-file" name="file" type="file" accept="application/pdf,image/jpeg,image/png" required={required} className="input py-2" />
        <p className="mt-1 text-xs text-muted">{required ? d["doc.fileRequired"] : d["doc.fileOptional"]}</p>
      </Field>
      <Field id="doc-note" label={d["common.note"]} wide>
        <input id="doc-note" name="note" defaultValue={v?.note} className="input" />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button className="btn" disabled={pending}>{d["common.save"]}</button>
        {state.error && <Message state={state} d={d} />}
      </div>
    </form>
  );
}
