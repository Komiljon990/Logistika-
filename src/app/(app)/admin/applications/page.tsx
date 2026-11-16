import Link from "next/link";
import type { ApplicationStatus } from "@prisma/client";
import { getLocale, getT } from "@/i18n";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { formatPhone } from "@/lib/phone";
import { planLabel } from "@/lib/offer";

const TABS: ApplicationStatus[] = ["PENDING", "APPROVED", "REJECTED"];

/** Super Admin: saytdan kelgan ro'yxatdan o'tish arizalari. */
export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  await requirePermission("org.manage");
  const t = await getT();
  const locale = await getLocale();
  const { s } = await searchParams;
  const status = TABS.includes(s as ApplicationStatus) ? (s as ApplicationStatus) : "PENDING";
  const [apps, counts] = await Promise.all([
    db.orgApplication.findMany({ where: { status }, orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" }, take: 200 }),
    db.orgApplication.groupBy({ by: ["status"], _count: true }),
  ]);
  const count = (st: ApplicationStatus) => counts.find((c) => c.status === st)?._count ?? 0;
  const fmt = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "uz-UZ", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Tashkent" });
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold">{t("app.title")}</h1>
      <nav className="flex flex-wrap gap-2">
        {TABS.map((st) => (
          <Link key={st} href={`/admin/applications?s=${st}`} className={st === status ? "btn" : "btn-ghost"}>
            {t(`app.status.${st}`)} ({count(st)})
          </Link>
        ))}
      </nav>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">{t("app.date")}</th>
              <th className="px-4 py-2 font-medium">{t("common.org")}</th>
              <th className="px-4 py-2 font-medium">{t("org.inn")}</th>
              <th className="px-4 py-2 font-medium">{t("role.DIRECTOR")}</th>
              <th className="px-4 py-2 font-medium">{t("reg.plan")}</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((a) => (
              <tr key={a.id} className="border-t border-line">
                <td className="px-4 py-2.5 tabular-nums text-muted">{fmt.format(a.createdAt)}</td>
                <td className="px-4 py-2.5"><Link href={`/admin/applications/${a.id}`} className="text-accent hover:underline">{a.orgName}</Link></td>
                <td className="px-4 py-2.5 tabular-nums">{a.inn}</td>
                <td className="px-4 py-2.5">{a.directorName}<span className="block text-xs text-muted">{formatPhone(a.phone)} · {a.email}</span></td>
                <td className="px-4 py-2.5">{planLabel(a.plan)} · {t(a.period === "YEARLY" ? "reg.yearly" : "reg.monthly")}</td>
              </tr>
            ))}
            {apps.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-muted">{t("common.none")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
