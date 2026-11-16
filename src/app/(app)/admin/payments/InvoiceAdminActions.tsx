import type { InvoiceStatus } from "@prisma/client";
import type { Dict } from "@/i18n";
import { ActionButton } from "@/components/ActionButton";
import { cancelInvoice, confirmInvoice, rejectReceipt } from "./actions";

/** Super Admin: to'lovni tasdiqlash, kvitansiyani rad etish, hisobni bekor qilish. */
export function InvoiceAdminActions({ d, id, status }: { d: Dict; id: string; status: InvoiceStatus }) {
  if (status === "PAID" || status === "CANCELLED") return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ActionButton d={d} action={confirmInvoice.bind(null, id)} label={d["inv.confirm"]} confirm={d["inv.confirmAsk"]} ok={d["inv.status.PAID"]} />
      {status === "REVIEW" && (
        <details className="relative">
          <summary className="btn-ghost cursor-pointer list-none">{d["inv.reject"]}</summary>
          <form action={rejectReceipt.bind(null, id)} className="card absolute right-0 z-10 mt-2 grid w-72 gap-2 p-3 shadow-lg">
            <label htmlFor={`note-${id}`} className="label">{d["app.reason"]}</label>
            <textarea id={`note-${id}`} name="note" rows={2} maxLength={500} className="input" />
            <button className="btn-danger">{d["inv.reject"]}</button>
          </form>
        </details>
      )}
      {status === "UNPAID" && <ActionButton d={d} action={cancelInvoice.bind(null, id)} label={d["inv.cancel"]} className="btn-ghost" confirm={d["inv.cancelAsk"]} />}
    </div>
  );
}
