import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getT } from "@/i18n";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/phone";
import { LangSwitch } from "@/components/LangSwitch";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  const t = await getT();
  const theme = (await cookies()).get("theme")?.value;
  // Demo hisoblar (reklama uchun): parol ochiq, hisoblar hech narsani saqlay olmaydi.
  const demoPassword = process.env.DEMO_PASSWORD;
  const demoUsers = demoPassword
    ? await db.user.findMany({ where: { isDemo: true, status: "ACTIVE", org: { isDemo: true, status: "ACTIVE" } }, orderBy: { phone: "asc" }, select: { phone: true, role: true } })
    : [];
  const demo = demoUsers.map((u) => ({ role: t(`role.${u.role}`), phone: formatPhone(u.phone), password: demoPassword! }));
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="card grid w-full max-w-md gap-5 p-7 shadow-lg">
        <div className="flex items-center gap-2">
          <Logo name={t("appName")} />
          <span className="flex-1" />
          <ThemeToggle
            initial={theme === "light" || theme === "dark" ? theme : "system"}
            labels={{ system: t("theme.system"), light: t("theme.light"), dark: t("theme.dark") }}
          />
        </div>
        <p className="-mt-3 text-sm text-muted">{t("app.tagline")}</p>
        <h1 className="text-2xl font-bold">{t("login.title")}</h1>
        <LoginForm
          demo={demo}
          demoLabels={{ title: t("demo.title"), hint: t("demo.hint"), enter: t("demo.enter"), login: t("demo.login"), password: t("login.password") }}
          labels={{
            phone: t("login.phone"),
            password: t("login.password"),
            submit: t("login.submit"),
            errors: {
              invalid: t("login.error.invalid"),
              locked: t("login.error.locked"),
              blocked: t("login.error.blocked"),
              tempExpired: t("login.error.tempExpired"),
            },
          }}
        />
        <Link href="/register" className="btn grid justify-items-center gap-0.5 py-3 text-center">
          <span className="font-semibold">{t("reg.button")}</span>
          <span className="text-xs font-normal opacity-90">{t("reg.buttonHint")}</span>
        </Link>
        <Link href="/login/code" className="rounded-lg border border-line px-3 py-2.5 text-sm hover:border-accent">
          <span className="font-semibold text-accent">{t("login.codeLink")}</span>
          <span className="block text-xs text-muted">{t("login.codeLinkHint")}</span>
        </Link>
        <div className="justify-self-center"><LangSwitch /></div>
      </div>
    </main>
  );
}
