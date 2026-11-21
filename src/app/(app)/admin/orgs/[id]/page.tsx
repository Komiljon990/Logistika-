import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict, getT } from "@/i18n";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { formatPhone } from "@/lib/phone";
import { StatusPill } from "@/components/StatusPill";
import { MemberForm, ResendInviteButton } from "@/components/MemberForms";
import { OrgForm } from "../../Forms";
import { addDirector, resendDirectorInvite, setDirectorStatus, setOrgStatus } from "../../actions";
import { InvoiceList } from "@/components/InvoiceList";
import { activeTractors } from "@/lib/billing";
import { PLANS, planLimit } from "@/lib/billing-core";
import { planLabel } from "@/lib/offer";
import { formatDate, toInputDate } from "@/lib/dates";
import { InvoiceAdminActions } from "../../payments/InvoiceAdminActions";
import { setSubscription } from "../../payments/actions";
import { SubscriptionForm } from "./SubscriptionForm";

/** Super Admin: tashkilot rekvizitlari va rahbarlari. Xodimlar ro'yxati va ma'lumotlar ko'rinmaydi (faqat soni). */
export default async function OrgPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  await requirePermission("org.manage");
  const { id } = await params;
  const { created } = await searchParams;
  const [t, d] = [await getT(), await getDict()];
  const org = await db.organization.findUnique({
    where: { id },
    include: {
      users: { where: { role: "DIRECTOR" }, orderBy: { createdAt: "asc" }, include: { account: { select: { email: true, passwordHash: true } } } },
      _count: { select: { users: true } },
    },
  });
  if (!org || org.isDemo) notFound();
  const [invoices, tractors] = await Promise.all([
    db.invoice.findMany({ where: { orgId: org.id }, orderBy: { createdAt: "desc" } }),
    activeTractors(org.id),
  ]);
  const toggle = setOrgStatus.bind(null, org.id, org.status === "ACTIVE" ? "BLOCKED" : "ACTIVE");
  return (
    <div className="grid gap-6">
      <Link href="/admin/orgs" className="text-sm text-accent hover:underline">← {t("org.title")}</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{org.name}</h1>
        <StatusPill status={org.status} t={t} />
        <span className="flex-1" />
        <form action={toggle}>
          <button className={org.status === "ACTIVE" ? "btn-danger" : "btn-ghost"}>
            {org.status === "ACTIVE" ? t("common.block") : t("common.unblock")}
          </button>
        </form>
      </div>
      {created && <p className="card border-accent p-4 text-sm">{t("org.created")}</p>}
      <section className="card p-5"><OrgForm d={d} org={org} /></section>

      <section className="grid gap-3">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold">{t("org.directors")}</h2>
          <p className="text-sm text-muted">{t("org.directorsHint").replace("{n}", String(org._count.users))}</p>
        </div>
        <div className="card divide-y divide-line">
          {org.users.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1 text-sm">
                <span className="font-semibold">{u.fullName}</span>
                <span className="block text-muted">
                  {u.account.email ?? "—"}{u.phone ? ` · ${formatPhone(u.phone)}` : ""}
                  {!u.account.passwordHash && u.status === "ACTIVE" ? ` · ${t("team.pending")}` : ""}
                </span>
              </span>
              <StatusPill status={u.status} t={t} />
              {u.status === "ACTIVE" && <ResendInviteButton d={d} action={resendDirectorInvite.bind(null, u.id)} />}
              <form action={setDirectorStatus.bind(null, u.id, u.status !== "ACTIVE")}>
                <button className={u.status === "ACTIVE" ? "btn-danger" : "btn-ghost"}>{u.status === "ACTIVE" ? t("common.block") : t("common.unblock")}</button>
              </form>
            </div>
          ))}
          {org.users.length === 0 && <p className="px-4 py-6 text-sm text-muted">{t("common.none")}</p>}
        </div>
        <details className="card p-5">
          <summary className="cursor-pointer font-semibold text-accent">{t("org.addDirector")}</summary>
          <div className="mt-4"><MemberForm d={d} action={addDirector.bind(null, org.id)} submit={t("common.add")} /></div>
        </details>
      </section>
      <section className="grid gap-3">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold">{t("sub.title")}</h2>
          <p className="text-sm text-muted">
            {org.plan ? `${planLabel(org.plan)} · ${t(org.period === "YEARLY" ? "reg.yearly" : "reg.monthly")} · ${formatDate(org.subStart)} – ${formatDate(org.subEnd)}` : t("sub.noPlan")}
            {" · "}{t("sub.tractors").replace("{n}", String(tractors)).replace("{limit}", planLimit(org.plan)?.toString() ?? "∞")}
            {org.contractDate ? ` · ${t("sub.contractDate")}: ${formatDate(org.contractDate)}` : ""}
          </p>
        </div>
        <InvoiceList t={t} invoices={invoices} actions={(inv) => <InvoiceAdminActions d={d} id={inv.id} status={inv.status} />} />
        <details className="card p-5">
          <summary className="cursor-pointer font-semibold text-accent">{t("sub.manual")}</summary>
          <div className="mt-4">
            <SubscriptionForm
              d={d}
              action={setSubscription.bind(null, org.id)}
              plans={PLANS.map((p) => ({ id: p.id, label: planLabel(p.id) }))}
              org={{ plan: org.plan, period: org.period, subStart: toInputDate(org.subStart), subEnd: toInputDate(org.subEnd), contractDate: toInputDate(org.contractDate) }}
            />
          </div>
        </details>
      </section>
      <p className="text-xs text-muted">{t("org.adminNoData")}</p>
    </div>
  );
}
