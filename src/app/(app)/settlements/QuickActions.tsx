"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import type { Dict } from "@/i18n";
import { ChargeForm } from "./forms";

type Person = { id: string; label: string };
type Ship = { id: string; clientId: string; label: string; currency: string };

/**
 * Hisob-kitob ro'yxatlari tepasidagi "+ Hisob qo'shish" va "+ To'lov" tugmalari: avval shaxs tanlanadi.
 * Haydovchi/ijarachi — hisob yoki to'lov oynasi o'sha shaxs sahifasida ochiladi;
 * mijoz — to'lov mijoz sahifasida, qo'shimcha hisob esa shu yerning o'zida (yuk qismi tanlanib) kiritiladi.
 */
export function QuickActions({ d, base, people, shipments, today, pickLabel, extra }: {
  d: Dict; base: string; people: Person[]; shipments?: Ship[]; today: string; pickLabel: string; extra?: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<"CHARGE" | "PAYMENT" | null>(null);
  const [person, setPerson] = useState("");
  const [shipment, setShipment] = useState("");
  const clientMode = !!shipments;
  const ships = (shipments ?? []).filter((s) => s.clientId === person);
  const ship = ships.find((s) => s.id === shipment);
  const toggle = (k: "CHARGE" | "PAYMENT") => { setOpen(open === k ? null : k); setPerson(""); setShipment(""); };
  const go = () => router.push(clientMode ? `${base}/${person}#pay` : `${base}/${person}?add=${open}`);

  return (
    <div className="grid gap-3 print:hidden">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={open === "CHARGE" ? "btn" : "btn-ghost"} onClick={() => toggle("CHARGE")}>+ {d["lessor.addCharge"]}</button>
        <button type="button" className={open === "PAYMENT" ? "btn" : "btn-ghost"} onClick={() => toggle("PAYMENT")}>+ {d["lessor.addPayment"]}</button>
        {extra}
      </div>
      {open && (
        <div className={`card grid gap-3 border-2 p-4 ${open === "CHARGE" ? "border-warn" : "border-accent"}`}>
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label={pickLabel} value={person} onChange={(e) => { setPerson(e.target.value); setShipment(""); }} className="input w-auto min-w-0 flex-1 basis-60">
              <option value="" disabled>{pickLabel}</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            {clientMode && open === "CHARGE" && person && (
              <select aria-label={d["quick.pickShipment"]} value={shipment} onChange={(e) => setShipment(e.target.value)} className="input w-auto min-w-0 flex-1 basis-60">
                <option value="" disabled>{ships.length ? d["quick.pickShipment"] : d["quick.noShipments"]}</option>
                {ships.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            )}
            {!(clientMode && open === "CHARGE") && (
              <button type="button" className="btn" disabled={!person} onClick={go}>{d["quick.continue"]}</button>
            )}
            <button type="button" className="btn-ghost" onClick={() => toggle(open)}>✕ {d["common.close"]}</button>
          </div>
          {clientMode && open === "CHARGE" && ship && (
            <ChargeForm key={ship.id} d={d} shipmentId={ship.id} currency={ship.currency} today={today} defaultOpen />
          )}
        </div>
      )}
    </div>
  );
}
