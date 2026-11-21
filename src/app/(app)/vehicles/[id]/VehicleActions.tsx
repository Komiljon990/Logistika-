"use client";

import { useActionState } from "react";
import type { Dict } from "@/i18n";
import { deleteVehicle, setVehicleStatus, type DeleteState } from "../../fleet-actions";

/** Transport kartochkasidagi tugmalar: tahrirlash, nofaol qilish / faollashtirish, o'chirish. */
export function VehicleActions({ d, id, plate, active, canEdit, canDelete }: {
  d: Dict; id: string; plate: string; active: boolean; canEdit: boolean; canDelete: boolean;
}) {
  const [delState, delAction, deleting] = useActionState(async (prev: DeleteState) => deleteVehicle(id, prev), {} as DeleteState);
  const [, statusAction, toggling] = useActionState(async () => { await setVehicleStatus(id, active ? "ARCHIVED" : "ACTIVE"); }, undefined);
  return (
    <div className="grid justify-items-end gap-2">
      <div className="flex flex-wrap gap-2">
        {canEdit && active && <a href="#details" className="btn-ghost">{d["common.edit"]}</a>}
        {canEdit && (
          <form action={statusAction}>
            <button className={active ? "btn-ghost" : "btn"} disabled={toggling}>{active ? d["veh.deactivate"] : d["common.restore"]}</button>
          </form>
        )}
        {canDelete && (
          <form
            action={delAction}
            onSubmit={(e) => { if (!window.confirm(`${plate}: ${d["veh.deleteConfirm"]}`)) e.preventDefault(); }}
          >
            <button className="btn-danger" disabled={deleting}>{d["common.delete"]}</button>
          </form>
        )}
      </div>
      {delState.error && <p role="alert" className="max-w-md rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{d[delState.error]}</p>}
    </div>
  );
}
