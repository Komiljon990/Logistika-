import { notFound } from "next/navigation";
import { getDict, getT } from "@/i18n";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { canResetPassword } from "@/lib/roles";
import { assertCanSeeOrg, ForbiddenError } from "@/lib/scope";
import { formatPhone } from "@/lib/phone";
import { StatusPill } from "@/components/StatusPill";
import { PasswordResetForm } from "@/components/PasswordResetForm";

/** Rahbar: xodim sahifasi. Parol formasi faqat ruxsat bo'lsa ko'rinadi (server ham alohida tekshiradi). */
export default async function TeamMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePermission("team.view");
  const { id } = await params;
  const [t, d] = [await getT(), await getDict()];
  const user = await db.user.findUnique({ where: { id } });
  if (!user) notFound();
  try {
    assertCanSeeOrg(me, user.orgId);
  } catch (e) {
    if (e instanceof ForbiddenError) notFound();
    throw e;
  }
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{user.fullName}</h1>
        <StatusPill status={user.status} t={t} />
      </div>
      <p className="text-sm text-muted">
        {t(`role.${user.role}`)} · <span className="tabular-nums">{formatPhone(user.phone)}</span>
      </p>
      {canResetPassword(me, user) ? (
        <section className="card p-5"><PasswordResetForm d={d} userId={user.id} /></section>
      ) : (
        <p className="card p-5 text-sm text-muted">{t("user.resetOnlyAdmin")}</p>
      )}
    </div>
  );
}
