import { getT } from "@/i18n";
import { requireSession } from "@/lib/session";
import { activeMemberships } from "@/lib/login";
import { switchOrg, logout } from "@/app/actions";
import { Logo } from "@/components/Logo";

/** Bir shaxs bir nechta tashkilotda: qaysi birida ishlashni tanlaydi. Ma'lumotlar har tashkilotda alohida. */
export default async function SelectOrgPage() {
  const user = await requireSession();
  const t = await getT();
  const members = (await activeMemberships(user.accountId)).filter((m) => !m.org?.isDemo || user.isDemo);
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="card grid w-full max-w-md gap-5 p-7 shadow-lg">
        <Logo name={t("appName")} />
        <h1 className="text-2xl font-bold">{t("org.select")}</h1>
        <p className="-mt-2 text-sm text-muted">{t("org.selectHint")}</p>
        <div className="grid gap-2">
          {members.map((m) => (
            <form key={m.id} action={switchOrg}>
              <input type="hidden" name="userId" value={m.id} />
              <button className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left hover:border-accent ${m.id === user.id ? "border-accent" : "border-line"}`}>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{m.org?.name ?? t("admin.panel")}</span>
                  <span className="block text-sm text-muted">{t(`role.${m.role}`)}</span>
                </span>
                <span aria-hidden className="text-accent">→</span>
              </button>
            </form>
          ))}
        </div>
        <form action={logout}><button className="text-sm text-accent hover:underline">{t("logout")}</button></form>
      </div>
    </main>
  );
}
