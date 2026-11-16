import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict, getLocale, getT } from "@/i18n";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { canManageMember, MEMBER_ROLES } from "@/lib/auth-core";
import { assertCanSeeOrg, ForbiddenError } from "@/lib/scope";
import { formatPhone } from "@/lib/phone";
import { StatusPill } from "@/components/StatusPill";
import { MemberForm, ResendInviteButton } from "@/components/MemberForms";
import { resendInvite, setMemberStatus, updateMember } from "../actions";

/**
 * Rahbar: xodim sahifasi. Parol tiklash yoki xodim nomidan kirish imkoni yo'q (16.11.2026) — xodim parolini
 * o'zi e-mail kodi orqali tiklaydi; yordam kerak bo'lsa, o'zi vaqtincha parol yaratib beradi.
 */
export default async function TeamMemberPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ added?: string }> }) {
  const me = await requirePermission("team.view");
  const { id } = await params;
  const { added } = await searchParams;
  const [t, d, locale] = [await getT(), await getDict(), await getLocale()];
  const user = await db.user.findUnique({ where: { id }, include: { account: { select: { email: true, passwordHash: true, lastLoginAt: true } } } });
  if (!user) notFound();
  try {
    assertCanSeeOrg(me, user.orgId);
  } catch (e) {
    if (e instanceof ForbiddenError) notFound();
    throw e;
  }
  const manage = canManageMember(me, user);
  const fmt = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "uz-UZ", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Tashkent" });
  const toggle = setMemberStatus.bind(null, user.id, user.status !== "ACTIVE");
  return (
    <div className="grid gap-6">
      <Link href="/team" className="text-sm text-accent hover:underline">← {t("team.title")}</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{user.fullName}</h1>
        <StatusPill status={user.status} t={t} />
        <span className="flex-1" />
        {manage && (
          <form action={toggle}>
            <button className={user.status === "ACTIVE" ? "btn-danger" : "btn-ghost"}>
              {user.status === "ACTIVE" ? t("common.block") : t("common.unblock")}
            </button>
          </form>
        )}
      </div>
      {added && <p className="card border-accent p-4 text-sm">{t("team.added")}</p>}
      <p className="text-sm text-muted">
        {t(`role.${user.role}`)} · {user.account.email ?? "—"}{user.phone ? <> · <span className="tabular-nums">{formatPhone(user.phone)}</span></> : null}
        <span className="block">
          {user.account.passwordHash
            ? `${t("user.lastLogin")}: ${user.account.lastLoginAt ? fmt.format(user.account.lastLoginAt) : "—"}`
            : t("team.pendingLong")}
        </span>
      </p>
      {manage ? (
        <>
          <section className="card p-5">
            <MemberForm
              d={d}
              action={updateMember.bind(null, user.id)}
              roles={MEMBER_ROLES}
              member={{ fullName: user.fullName, email: user.account.email, phone: user.phone, role: user.role }}
              submit={t("common.save")}
            />
          </section>
          {user.status === "ACTIVE" && (
            <section className="card grid gap-3 p-5">
              <p className="text-sm text-muted">{t(user.account.passwordHash ? "team.inviteAgainHint" : "team.invitePendingHint")}</p>
              <ResendInviteButton d={d} action={resendInvite.bind(null, user.id)} />
            </section>
          )}
        </>
      ) : (
        <p className="card p-5 text-sm text-muted">{t("team.notManaged")}</p>
      )}
      <p className="text-xs text-muted">{t("team.noReset")}</p>
    </div>
  );
}
