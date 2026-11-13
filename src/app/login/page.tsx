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
    ? await db.user.findMany({ where: { isDemo: true, status: "ACTIVE" }, orderBy: { phone: "asc" }, select: { phone: true, role: true } })
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
            },
          }}
        />
        <p className="text-xs text-muted">{t("login.forgot")}</p>
        <div className="justify-self-center"><LangSwitch /></div>
      </div>
    </main>
  );
}
