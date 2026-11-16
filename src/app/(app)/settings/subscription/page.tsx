import Link from "next/link";
import { getDict, getT } from "@/i18n";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/roles";
import { orgForWrite } from "@/lib/scope";
import { formatDate } from "@/lib/dates";
import { canRenew, fitsPlan, isPlan, PLANS, planLimit, planRank, quote, RENEW_WINDOW_DAYS, upgradeQuote } from "@/lib/billing-core";
import { activeTractors, todayDate } from "@/lib/billing";
import { planLabel, providerLines, som } from "@/lib/offer";
import { getProvider } from "@/lib/settings";
import { InvoiceList } from "@/components/InvoiceList";
import { ReceiptForm, RenewForm, UpgradeForm } from "./Forms";
import { uploadReceipt } from "./actions";

/** Tashkilot obunasi: tarif, muddat, to'lov hisoblari va kvitansiyalar (rahbar va buxgalter). */
export default async function SubscriptionPage() {
  const user = await requirePermission("data.view");
  const [t, d] = [await getT(), await getDict()];
  const orgId = orgForWrite(user);
  const manage = can(user.role, "billing.manage") && !user.readOnly;
  const [org, invoices, tractors, provider] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: orgId } }),
    db.invoice.findMany({ where: { orgId }, orderBy: { createdAt: "desc" }, take: 50 }),
    activeTractors(orgId),
    getProvider(),
  ]);
  const today = todayDate();
  const limit = planLimit(org.plan);
  const current = isPlan(org.plan) && org.period && org.subStart && org.subEnd ? { plan: org.plan, period: org.period, start: org.subStart, end: org.subEnd } : null;
  const expired = !!org.subEnd && org.subEnd < today;
  const upgrades = current && !expired
    ? PLANS.filter((p) => planRank(p.id) > planRank(current.plan)).flatMap((p) => {
        const q = upgradeQuote(current, p.id, today);
        return q.ok ? [{ id: p.id, label: planLabel(p.id), price: `${som(q.amount)}${q.discountPercent ? ` (−${q.discountPercent}%)` : ""}` }] : [];
      })
    : [];
  const renew = !org.isDemo && canRenew(org.subEnd, today);
  const unpaid = invoices.some((i) => i.status === "UNPAID");
  const pay = providerLines(provider).filter(([k]) => ["Nomi", "STIR", "Bank", "MFO", "Hisob raqami"].includes(k));

  return (
    <div className="grid max-w-3xl gap-6">
      <Link href="/settings" className="text-sm text-accent hover:underline">← {t("settings.title")}</Link>
      <h1 className="text-2xl font-bold">{t("sub.title")}</h1>

      <section className="card grid gap-3 p-5">
        <dl className="grid gap-2 text-sm sm:grid-cols-[200px_1fr]">
          <dt className="text-muted">{t("reg.plan")}</dt>
          <dd className="font-semibold">{org.plan ? `${planLabel(org.plan)} · ${t(org.period === "YEARLY" ? "reg.yearly" : "reg.monthly")}` : t("sub.noPlan")}</dd>
          {org.subEnd && (<><dt className="text-muted">{t("sub.period")}</dt><dd className={expired ? "font-semibold text-bad" : ""}>{formatDate(org.subStart)} – {formatDate(org.subEnd)}{expired ? ` · ${t("sub.expired")}` : ""}</dd></>)}
          <dt className="text-muted">{t("sub.activeTractors")}</dt>
          <dd className={limit !== null && tractors >= limit ? "font-semibold text-warn" : ""}>{tractors} / {limit ?? "∞"}</dd>
          {org.contractDate && (<><dt className="text-muted">{t("sub.contractDate")}</dt><dd>{formatDate(org.contractDate)} · <Link href="/oferta" target="_blank" className="text-accent hover:underline">{t("reg.offerTitle")} ↗</Link></dd></>)}
        </dl>
        {limit !== null && tractors >= limit && <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{t("sub.atLimit")}</p>}
      </section>

      {unpaid && pay.length > 0 && (
        <section className="card grid gap-2 p-5">
          <h2 className="text-lg font-semibold">{t("sub.howToPay")}</h2>
          <p className="text-sm text-muted">{t("sub.howToPayHint")}</p>
          <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[140px_1fr]">
            {pay.map(([k, v]) => <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="select-all tabular-nums">{v}</dd></div>)}
          </dl>
        </section>
      )}

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">{t("inv.title")}</h2>
        <InvoiceList
          t={t}
          invoices={invoices}
          actions={(inv) => manage && (inv.status === "UNPAID" || inv.status === "REVIEW") ? <ReceiptForm d={d} action={uploadReceipt.bind(null, inv.id)} /> : null}
        />
      </section>

      {manage && upgrades.length > 0 && (
        <section className="card grid gap-3 p-5">
          <div className="grid gap-1">
            <h2 className="text-lg font-semibold">{t("sub.upgrade")}</h2>
            <p className="text-sm text-muted">{t("sub.upgradeHint").replace("{date}", formatDate(org.subEnd))}</p>
          </div>
          <UpgradeForm d={d} options={upgrades} />
        </section>
      )}

      {manage && current && (
        <section className="card grid gap-3 p-5">
          <div className="grid gap-1">
            <h2 className="text-lg font-semibold">{t("sub.renew")}</h2>
            <p className="text-sm text-muted">{renew ? t("sub.renewHint") : t("sub.renewLater").replace("{n}", String(RENEW_WINDOW_DAYS))}</p>
          </div>
          {renew && (
            <RenewForm
              d={d}
              current={{ plan: current.plan, period: current.period }}
              plans={PLANS.map((p) => ({
                id: p.id, label: planLabel(p.id), fits: fitsPlan(p.id, tractors),
                monthly: som(quote(p.id, "MONTHLY", today).amount), yearly: som(quote(p.id, "YEARLY", today).amount),
              }))}
            />
          )}
        </section>
      )}
    </div>
  );
}
