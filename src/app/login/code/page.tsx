import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getT } from "@/i18n";
import { getCurrentUser } from "@/lib/session";
import { senderAddress } from "@/lib/mailer";
import { LangSwitch } from "@/components/LangSwitch";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CodeForm } from "./CodeForm";

/** Ilk kirish va parolni tiklash: faqat shaxsning o'z e-mailiga kelgan kod orqali. */
export default async function CodePage() {
  if (await getCurrentUser()) redirect("/");
  const t = await getT();
  const theme = (await cookies()).get("theme")?.value;
  const from = senderAddress();
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
        <h1 className="text-2xl font-bold">{t("code.title")}</h1>
        <CodeForm
          l={{
            hint: t("code.hint"),
            email: t("code.email"),
            send: t("code.send"),
            sentTo: from ? `${t("code.sentTo")} ${t("code.spamHint").replace("{from}", from)}` : t("code.sentTo"),
            code: t("code.code"),
            newPassword: t("user.newPassword"),
            confirm: t("user.passwordConfirm"),
            submit: t("code.submit"),
            resend: t("code.resend"),
            other: t("code.other"),
            errors: {
              email: t("code.error.email"),
              code: t("code.error.code"),
              password: t("user.error.password"),
              mismatch: t("user.error.passwordMismatch"),
              blocked: t("login.error.blocked"),
            },
          }}
        />
        <Link href="/login" className="text-sm text-accent hover:underline">← {t("login.title")}</Link>
        <div className="justify-self-center"><LangSwitch /></div>
      </div>
    </main>
  );
}
