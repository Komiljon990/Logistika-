import { redirect } from "next/navigation";
import { getDict, getT } from "@/i18n";
import { getCurrentUser } from "@/lib/session";
import { Logo } from "@/components/Logo";
import { logout } from "@/app/actions";
import { SetPasswordForm } from "./SetPasswordForm";

/** Vaqtincha parol bilan birinchi kirish: avval o'z parolini o'rnatadi. */
export default async function SetPasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.mustChangePassword) redirect("/");
  const [t, d] = [await getT(), await getDict()];
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="card grid w-full max-w-md gap-5 p-7 shadow-lg">
        <Logo name={t("appName")} />
        <h1 className="text-2xl font-bold">{t("setpw.title")}</h1>
        <p className="text-sm text-muted">{t("setpw.hint").replace("{name}", user.fullName)}</p>
        <SetPasswordForm d={d} />
        <form action={logout}><button className="text-sm text-accent hover:underline">{t("logout")}</button></form>
      </div>
    </main>
  );
}
