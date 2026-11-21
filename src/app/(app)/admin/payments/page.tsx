import Link from "next/link";
import type { InvoiceStatus } from "@prisma/client";
import { getDict, getT } from "@/i18n";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { InvoiceList } from "@/components/InvoiceList";
import { InvoiceAdminActions } from "./InvoiceAdminActions";

const TABS: InvoiceStatus[] = ["REVIEW", "UNPAID", "PAID", "CANCELLED"];

/** Super Admin: to'lov hisoblari; kvitansiya yuklanganlari birinchi. */
export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  await requirePermission("org.manage");
  const [t, d] = [await getT(), await getDict()];
  const { s } = await searchParams;
  const status = TABS.includes(s as InvoiceStatus) ? (s as InvoiceStatus) : "REVIEW";
  const [invoices, counts] = await Promise.all([
    db.invoice.findMany({ where: { status }, orderBy: { createdAt: status === "REVIEW" ? "asc" : "desc" }, take: 200, include: { org: { select: { id: true, name: true } } } }),
    db.invoice.groupBy({ by: ["status"], _count: true }),
  ]);
  const count = (st: InvoiceStatus) => counts.find((c) => c.status === st)?._count ?? 0;
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold">{t("inv.title")}</h1>
      <nav className="flex flex-wrap gap-2">
        {TABS.map((st) => (
          <Link key={st} href={`/admin/payments?s=${st}`} className={st === status ? "btn" : "btn-ghost"}>
            {t(`inv.status.${st}`)} ({count(st)})
          </Link>
        ))}
      </nav>
      <InvoiceList t={t} invoices={invoices} showOrg actions={(inv) => <InvoiceAdminActions d={d} id={inv.id} status={inv.status} />} />
    </div>
  );
}
