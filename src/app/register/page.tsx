import Link from "next/link";
import { cookies } from "next/headers";
import { getT } from "@/i18n";
import { LangSwitch } from "@/components/LangSwitch";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { OfferText } from "@/components/OfferText";
import { getProvider, providerReady } from "@/lib/settings";
import { discountFor, dmy, inTrial, PLANS, PROMO_UNTIL, quote, TRIAL_UNTIL } from "@/lib/billing-core";
import { OFFER_VERSION, som } from "@/lib/offer";
import { RegisterForm } from "./RegisterForm";

/** Ro'yxatdan o'tish: 1) tarif va ommaviy oferta, 2) tashkilot va rahbar ma'lumotlari → ariza Super Admin'ga. */
export default async function RegisterPage() {
  const t = await getT();
  const theme = (await cookies()).get("theme")?.value;
  const provider = await getProvider();
  const today = new Date();
  const promo = discountFor(today);
  const plans = PLANS.map((p) => ({
    id: p.id,
    label: p.limit === null ? t("reg.planOver").replace("{n}", "20") : t("reg.planUpTo").replace("{n}", String(p.limit)),
    monthly: som(quote(p.id, "MONTHLY", today).amount),
    yearly: som(quote(p.id, "YEARLY", today).amount),
    monthlyBase: promo ? som(p.monthly) : null,
    yearlyBase: promo ? som(p.yearly) : null,
  }));
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="card grid w-full max-w-3xl gap-5 p-6 shadow-lg sm:p-7">
        <div className="flex items-center gap-2">
          <Logo name={t("appName")} />
          <span className="flex-1" />
          <ThemeToggle
            initial={theme === "light" || theme === "dark" ? theme : "system"}
            labels={{ system: t("theme.system"), light: t("theme.light"), dark: t("theme.dark") }}
          />
        </div>
        <h1 className="text-2xl font-bold">{t("reg.title")}</h1>
        {providerReady(provider) ? (
          <RegisterForm
            plans={plans}
            offerVersion={OFFER_VERSION}
            offer={<OfferText provider={provider} />}
            l={{
              plansTitle: t("reg.plansTitle"),
              plan: t("reg.plan"),
              monthly: t("reg.monthly"),
              yearly: t("reg.yearly"),
              yearlyHint: t("reg.yearlyHint"),
              promo: [
                inTrial(today) ? t("reg.trial").replace("{d}", dmy(TRIAL_UNTIL)) : "",
                promo ? t("reg.promo").replace("{p}", String(promo)).replace("{d}", dmy(PROMO_UNTIL)) : "",
              ].filter(Boolean).join(" "),
              countHint: t("reg.countHint"),
              period: t("reg.period"),
              offerTitle: t("reg.offerTitle"),
              accept: t("reg.accept"),
              next: t("reg.next"),
              back: t("common.back"),
              formTitle: t("reg.formTitle"),
              orgName: t("reg.orgName"),
              inn: t("org.inn"),
              directorName: t("reg.directorName"),
              phone: t("user.phone"),
              email: t("reg.email"),
              emailHint: t("reg.emailHint"),
              submit: t("reg.submit"),
              done: t("reg.done"),
              doneHint: t("reg.doneHint"),
              chosen: t("reg.chosen"),
              errors: {
                required: t("common.required"),
                inn: t("reg.error.inn"),
                phone: t("user.error.phone"),
                email: t("code.error.email"),
                offer: t("reg.error.offer"),
                plan: t("reg.error.plan"),
                pending: t("reg.error.pending"),
                exists: t("reg.error.exists"),
                limit: t("reg.error.limit"),
                closed: t("reg.closed"),
              },
            }}
          />
        ) : (
          <p className="rounded-lg bg-accent-soft px-4 py-3 text-sm">{t("reg.closed")}</p>
        )}
        <Link href="/login" className="text-sm text-accent hover:underline">← {t("login.title")}</Link>
        <div className="justify-self-center"><LangSwitch /></div>
      </div>
    </main>
  );
}
