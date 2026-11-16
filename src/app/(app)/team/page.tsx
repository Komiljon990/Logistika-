import Link from "next/link";
import { getDict, getT } from "@/i18n";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { orgScope } from "@/lib/scope";
import { formatPhone } from "@/lib/phone";
import { MEMBER_ROLES } from "@/lib/auth-core";
import { StatusPill } from "@/components/StatusPill";
import { MemberForm } from "@/components/MemberForms";
import { addMember } from "./actions";

/** Rahbar: o'z tashkiloti xodimlari — qo'shish (F.I.O., e-mail, telefon, rol), tahrirlash, bloklash. */
export default async function TeamPage() {
  const me = await requirePermission("team.view");
  const [t, d] = [await getT(), await getDict()];
  const users = await db.user.findMany({
    where: orgScope(me),
    orderBy: [{ status: "asc" }, { fullName: "asc" }],
    include: { account: { select: { email: true, passwordHash: true } } },
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
              <th className="px-4 py-2 font-medium">{t("user.role")}</th>
              <th className="px-4 py-2 font-medium">E-mail</th>
              <th className="px-4 py-2 font-medium">{t("user.phone")}</th>
              <th className="px-4 py-2 font-medium">{t("common.status")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-line">
                <td className="px-4 py-2.5"><Link href={`/team/${u.id}`} className="text-accent hover:underline">{u.fullName}</Link></td>
                <td className="px-4 py-2.5">{t(`role.${u.role}`)}</td>
                <td className="px-4 py-2.5">{u.account.email ?? u.email ?? "—"}</td>
                <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{u.phone ? formatPhone(u.phone) : "—"}</td>
                <td className="px-4 py-2.5">
                  <StatusPill status={u.status} t={t} />
                  {!u.account.passwordHash && u.status === "ACTIVE" && <span className="ml-2 text-xs text-muted">{t("team.pending")}</span>}
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-muted">{t("common.none")}</td></tr>}
          </tbody>
        </table>
      </div>
      <section id="new" className="card grid gap-4 p-5">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold">{t("team.add")}</h2>
          <p className="text-sm text-muted">{t("team.addHint")}</p>
        </div>
        <MemberForm d={d} action={addMember} roles={MEMBER_ROLES} submit={t("common.add")} />
      </section>
    </div>
  );
}
