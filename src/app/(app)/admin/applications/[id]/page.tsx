import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict, getLocale, getT } from "@/i18n";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { formatPhone } from "@/lib/phone";
import { isPeriod, isPlan, quote } from "@/lib/billing-core";
import { todayDate } from "@/lib/billing";
import { planLabel, som } from "@/lib/offer";
import { ActionButton } from "@/components/ActionButton";
import { approveApplication, rejectApplication } from "../actions";

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("org.manage");
  const { id } = await params;
  const [t, d, locale] = [await getT(), await getDict(), await getLocale()];
  const app = await db.orgApplication.findUnique({ where: { id } });
  if (!app) notFound();
  const fmt = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "uz-UZ", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Tashkent" });
  const [sameInn, sameEmail] = await Promise.all([
    db.organization.findFirst({ where: { inn: app.inn, isDemo: false }, select: { id: true, name: true } }),
    db.account.findUnique({ where: { email: app.email }, select: { passwordHash: true, users: { where: { status: "ACTIVE" }, select: { org: { select: { name: true } } } } } }),
  ]);
  const q = isPlan(app.plan) && isPeriod(app.period) ? quote(app.plan, app.period, todayDate()) : null;
  const rows: [string, React.ReactNode][] = [
    [t("app.date"), fmt.format(app.createdAt)],
    [t("reg.orgName"), app.orgName],
    [t("org.inn"), app.inn],
    [t("reg.directorName"), app.directorName],
    [t("user.phone"), formatPhone(app.phone)],
    ["E-mail", app.email],
    [t("reg.plan"), `${planLabel(app.plan)} · ${t(app.period === "YEARLY" ? "reg.yearly" : "reg.monthly")}${q ? ` · ${som(q.amount)}` : ""}`],
    [t("app.offer"), `${app.offerVersion} · ${fmt.format(app.offerAcceptedAt)}${app.ip ? ` · IP ${app.ip}` : ""}`],
  ];
  return (
    <div className="grid max-w-3xl gap-6">
      <Link href="/admin/applications" className="text-sm text-accent hover:underline">← {t("app.title")}</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{app.orgName}</h1>
        <span className="rounded-full border border-line px-2.5 py-0.5 text-xs">{t(`app.status.${app.status}`)}</span>
      </div>
      <section className="card p-5">
        <dl className="grid gap-2 text-sm sm:grid-cols-[180px_1fr]">
          {rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd>{v}</dd></div>)}
        </dl>
      </section>
      {sameInn && <p className="card border-bad p-4 text-sm">{t("app.error.innTaken")} <Link className="text-accent hover:underline" href={`/admin/orgs/${sameInn.id}`}>{sameInn.name}</Link></p>}
      {sameEmail && (
        <p className="card p-4 text-sm text-muted">
          {t("app.existingAccount").replace("{orgs}", sameEmail.users.map((u) => u.org?.name ?? "Super Admin").join(", ") || "—")}
        </p>
      )}
      {app.status === "PENDING" && (
        <>
          <section className="card grid gap-3 p-5">
            <h2 className="text-lg font-semibold">{t("app.approve")}</h2>
            <p className="text-sm text-muted">{t("app.approveHint")}</p>
            <ActionButton d={d} action={approveApplication.bind(null, app.id)} label={t("app.approve")} confirm={t("app.approveConfirm")} />
          </section>
          <details className="card p-5">
            <summary className="cursor-pointer font-semibold text-bad">{t("app.reject")}</summary>
            <form action={rejectApplication.bind(null, app.id)} className="mt-4 grid gap-3">
              <div>
                <label htmlFor="reason" className="label">{t("app.reason")}</label>
                <textarea id="reason" name="reason" maxLength={500} rows={3} className="input" />
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notify" defaultChecked /> {t("app.notify")}</label>
              <button className="btn-danger justify-self-start">{t("app.reject")}</button>
            </form>
          </details>
        </>
      )}
      {app.status === "REJECTED" && app.rejectReason && <p className="text-sm text-muted">{t("app.reason")}: {app.rejectReason}</p>}
      {app.orgId && <Link href={`/admin/orgs/${app.orgId}`} className="text-sm text-accent hover:underline">{t("app.openOrg")} →</Link>}
    </div>
  );
}
