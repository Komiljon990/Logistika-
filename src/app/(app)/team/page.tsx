import Link from "next/link";
import { getT } from "@/i18n";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { orgScope } from "@/lib/scope";
import { formatPhone } from "@/lib/phone";
import { StatusPill } from "@/components/StatusPill";

/** Rahbar: o'z tashkiloti xodimlari ro'yxati. */
export default async function TeamPage() {
  const me = await requirePermission("team.view");
  const t = await getT();
  const users = await db.user.findMany({
    where: orgScope(me),
    orderBy: [{ status: "asc" }, { fullName: "asc" }],
  });
  return (
    <div className="grid gap-6">
      <Link href="/settings" className="text-sm text-accent hover:underline">← {t("settings.title")}</Link>
      <h1 className="text-2xl font-bold">{t("team.title")}</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">{t("user.fullName")}</th>
              <th className="px-4 py-2 font-medium">{t("user.phone")}</th>
              <th className="px-4 py-2 font-medium">{t("user.role")}</th>
              <th className="px-4 py-2 font-medium">{t("common.status")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-line">
                <td className="px-4 py-2.5"><Link href={`/team/${u.id}`} className="text-accent hover:underline">{u.fullName}</Link></td>
                <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{formatPhone(u.phone)}</td>
                <td className="px-4 py-2.5">{t(`role.${u.role}`)}</td>
                <td className="px-4 py-2.5"><StatusPill status={u.status} t={t} /></td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-muted">{t("common.none")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
