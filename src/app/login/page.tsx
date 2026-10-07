import { redirect } from "next/navigation";
import { getT } from "@/i18n";
import { getCurrentUser } from "@/lib/session";
import { LangSwitch } from "@/components/LangSwitch";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  const t = await getT();
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="card grid w-full max-w-sm gap-5 p-7">
        <div className="text-lg font-bold text-accent">{t("appName")}</div>
        <h1 className="text-2xl font-bold">{t("login.title")}</h1>
        <LoginForm
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
