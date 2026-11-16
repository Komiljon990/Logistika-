import Link from "next/link";
import { getDict, getLocale, getT } from "@/i18n";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { activeMemberships } from "@/lib/login";
import { formatPhone } from "@/lib/phone";
import { mailConfigured } from "@/lib/mailer";
import { switchOrg } from "@/app/actions";
import { EmailForm, GrantForm, PasswordForm, RevokeButton } from "./forms";

/**
 * Mening hisobim: e-mail, parol, tashkilotlarim va vaqtincha parol (yordamchiga berish uchun).
 * Vaqtincha parol bilan kirgan kishi bu bo'limlarni o'zgartira olmaydi.
 */
export default async function AccountPage() {
  const user = await requireSession();
  const [t, d, locale] = [await getT(), await getDict(), await getLocale()];
  const account = await db.account.findUniqueOrThrow({ where: { id: user.accountId }, select: { email: true, phone: true } });
  const members = (await activeMemberships(user.accountId)).filter((m) => !m.org?.isDemo || user.isDemo);
  const now = new Date();
  const grants = await db.accessGrant.findMany({ where: { accountId: user.accountId }, orderBy: { createdAt: "desc" }, take: 5 });
  const active = grants.find((g) => !g.revokedAt && g.expiresAt > now);
  const fmt = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "uz-UZ", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Tashkent" });
  const owner = !user.grant && !user.isDemo;

  return (
    <div className="grid max-w-3xl gap-6">
      <h1 className="text-2xl font-bold">{t("acc.title")}</h1>
      {user.grant && <p className="card border-accent p-4 text-sm">{t("acc.viaGrant")}</p>}
      {user.isDemo && <p className="card p-4 text-sm text-muted">{t("demo.blocked")}</p>}

      <section className="card grid gap-4 p-5">
        <h2 className="text-lg font-semibold">{t("acc.login")}</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-[160px_1fr]">
          <dt className="text-muted">{t("user.fullName")}</dt><dd>{user.fullName}</dd>
          <dt className="text-muted">E-mail</dt>
          <dd>{account.email ?? <span className="text-bad">{t("acc.noEmail")}</span>}</dd>
          <dt className="text-muted">{t("user.phone")}</dt><dd className="tabular-nums">{account.phone ? formatPhone(account.phone) : "—"}</dd>
        </dl>
        {!account.email && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm">{t("acc.noEmailHint")}</p>}
        {owner && <EmailForm d={d} current={account.email} />}
        {!mailConfigured() && <p className="text-xs text-muted">{t("acc.mailTestMode")}</p>}
      </section>

      {owner && (
        <section className="card grid gap-4 p-5">
          <h2 className="text-lg font-semibold">{t("acc.changePassword")}</h2>
          <PasswordForm d={d} />
          <p className="text-xs text-muted">{t("acc.forgotHint")}</p>
        </section>
      )}

      {members.length > 0 && (
        <section className="card grid gap-3 p-5">
          <h2 className="text-lg font-semibold">{t("acc.orgs")}</h2>
          <p className="text-sm text-muted">{t("org.selectHint")}</p>
          <div className="grid gap-2">
            {members.map((m) => (
              <form key={m.id} action={switchOrg} className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-4 py-2.5">
                <input type="hidden" name="userId" value={m.id} />
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{m.org?.name ?? t("admin.panel")}</span>
                  <span className="text-sm text-muted"> · {t(`role.${m.role}`)}</span>
                </span>
                {m.id === user.id ? <span className="text-sm text-accent">{t("org.current")}</span> : <button className="btn-ghost">{t("org.switch")}</button>}
              </form>
            ))}
          </div>
        </section>
      )}

      <section className="card grid gap-4 p-5">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold">{t("acc.grantTitle")}</h2>
          <p className="text-sm text-muted">{t("acc.grantHint")}</p>
        </div>
        {active ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-accent bg-accent-soft px-4 py-3">
            <span className="min-w-0 flex-1 text-sm">
              <span className="font-semibold">{t("acc.grantActive")}</span>: {t(active.mode === "EDIT" ? "acc.modeEDIT" : "acc.modeVIEW")} · {t("acc.until")} {fmt.format(active.expiresAt)}
              <span className="block text-xs text-muted">{t("acc.lastUsed")}: {active.lastUsedAt ? fmt.format(active.lastUsedAt) : t("acc.notUsed")}</span>
            </span>
            {owner && <RevokeButton d={d} />}
          </div>
        ) : (
          <p className="text-sm text-muted">{t("acc.noGrant")}</p>
        )}
        {owner && <GrantForm d={d} locale={locale} />}
        {grants.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted">{t("acc.grantHistory")}</summary>
            <ul className="mt-2 grid gap-1">
              {grants.map((g) => (
                <li key={g.id} className="text-muted">
                  {fmt.format(g.createdAt)} · {t(g.mode === "EDIT" ? "acc.modeEDIT" : "acc.modeVIEW")} ·{" "}
                  {g.revokedAt ? `${t("acc.revoked")} ${fmt.format(g.revokedAt)}` : g.expiresAt <= now ? t("acc.expired") : t("acc.grantActive")}
                  {g.lastUsedAt ? ` · ${t("acc.lastUsed")}: ${fmt.format(g.lastUsedAt)}` : ""}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
      {user.orgId && <Link href="/settings" className="text-sm text-accent hover:underline">← {t("settings.title")}</Link>}
    </div>
  );
}
