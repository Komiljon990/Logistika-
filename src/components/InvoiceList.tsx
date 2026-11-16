import type { Invoice } from "@prisma/client";
import type { T } from "@/i18n";
import { formatDate } from "@/lib/dates";
import { planLabel, som } from "@/lib/offer";

export type InvoiceRow = Invoice & { org?: { id: string; name: string } };

const TONE: Record<Invoice["status"], string> = {
  UNPAID: "border-warn text-warn",
  REVIEW: "border-accent text-accent",
  PAID: "border-line text-muted",
  CANCELLED: "border-line text-muted line-through",
};

/** To'lov hisoblari jadvali; `actions` — har qator uchun qo'shimcha tugmalar (Super Admin yoki rahbar). */
export function InvoiceList({ t, invoices, actions, showOrg }: {
  t: T; invoices: InvoiceRow[]; actions?: (inv: InvoiceRow) => React.ReactNode; showOrg?: boolean;
}) {
  if (invoices.length === 0) return <p className="card p-5 text-sm text-muted">{t("common.none")}</p>;
  return (
    <div className="card divide-y divide-line">
      {invoices.map((inv) => (
        <div key={inv.id} className="grid gap-2 px-4 py-3 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
          <div className="min-w-0 flex-1 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold tabular-nums">№ {inv.number}</span>
              {showOrg && inv.org && <a href={`/admin/orgs/${inv.org.id}`} className="text-accent hover:underline">{inv.org.name}</a>}
              <span className={`rounded-full border px-2 py-0.5 text-xs ${TONE[inv.status]}`}>{t(`inv.status.${inv.status}`)}</span>
            </div>
            <div className="text-muted">
              {t(`inv.kind.${inv.kind}`)} · {planLabel(inv.plan)} · {t(inv.period === "YEARLY" ? "reg.yearly" : "reg.monthly")} · {formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}
            </div>
            {inv.rejectNote && inv.status === "UNPAID" && <div className="text-bad">{t("inv.rejected")}: {inv.rejectNote}</div>}
          </div>
          <div className="text-right tabular-nums">
            <div className="font-semibold">{som(Number(inv.amount))}</div>
            {inv.discountPercent > 0 && <div className="text-xs text-muted"><s>{som(Number(inv.baseAmount))}</s> −{inv.discountPercent}%</div>}
          </div>
          {inv.receiptFileId && <a href={`/files/${inv.receiptFileId}`} target="_blank" rel="noopener" className="btn-ghost">{t("inv.receipt")}</a>}
          {actions?.(inv)}
        </div>
      ))}
    </div>
  );
}
