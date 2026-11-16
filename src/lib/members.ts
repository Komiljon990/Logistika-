import "server-only";
import type { Role } from "@prisma/client";
import { db } from "./db";
import { audit } from "./audit";
import { linkAccount, ROLE_LABEL_UZ, sendInvite } from "./accounts";
import { normalizeEmail } from "./auth-core";
import { normalizePhone } from "./phone";
import { fail, str, type FormState } from "./form";
import type { Dict } from "@/i18n";

export type MemberInput = { fullName: string; email: string; phone: string };

/** Rahbar/Super Admin kiritadigan shaxs ma'lumotlari: F.I.O., e-mail (majburiy — kod shu yerga boradi), telefon. */
export function parseMember(formData: FormData, needEmail = true): { data: MemberInput } | { error: keyof Dict } {
  const fullName = str(formData, "fullName").slice(0, 200);
  if (!fullName) return { error: "common.required" };
  const rawPhone = str(formData, "phone");
  const phone = rawPhone ? normalizePhone(rawPhone) : "";
  if (phone === null) return { error: "user.error.phone" };
  const email = needEmail ? normalizeEmail(str(formData, "email")) : "";
  if (email === null) return { error: "code.error.email" };
  return { data: { fullName, email, phone } };
}

/**
 * Tashkilotga a'zo qo'shadi: shaxs e-mail bo'yicha topiladi (boshqa tashkilotda allaqachon bo'lsa — o'sha login
 * bilan kiradi va tashkilotni tanlaydi) yoki yangi hisob yaratiladi. Taklifnoma e-mailga yuboriladi.
 */
export async function addMembership(opts: {
  orgId: string; role: Role; input: MemberInput; actorId: string; formData: FormData;
}): Promise<FormState & { id?: string }> {
  const org = await db.organization.findUnique({ where: { id: opts.orgId } });
  if (!org || org.isDemo) return fail("user.error.org", opts.formData);
  const link = await linkAccount(opts.input.email, opts.input.phone || null);
  if ("error" in link) return fail(link.error, opts.formData);
  const exists = await db.user.findFirst({ where: { accountId: link.accountId, orgId: opts.orgId } });
  if (exists) return fail("user.error.memberExists", opts.formData);
  const user = await db.user.create({
    data: { accountId: link.accountId, orgId: opts.orgId, role: opts.role, fullName: opts.input.fullName, phone: opts.input.phone, email: opts.input.email },
  });
  await audit({
    actorId: opts.actorId, orgId: opts.orgId, action: "team.add", entity: "User", entityId: user.id,
    details: { role: opts.role, fullName: opts.input.fullName, newAccount: link.isNew },
  });
  await sendInvite({ email: opts.input.email, fullName: opts.input.fullName, orgName: org.name, roleLabel: ROLE_LABEL_UZ[opts.role], hasPassword: link.hasPassword }).catch((e) => {
    console.error("Taklifnoma yuborilmadi:", e);
  });
  return { ok: true, id: user.id };
}

/** Taklifnomani qayta yuborish (masalan xat spamga tushgan bo'lsa). */
export async function resendInviteFor(userId: string) {
  const u = await db.user.findUnique({ where: { id: userId }, include: { account: true, org: true } });
  if (!u?.org || !u.account.email) return false;
  await sendInvite({ email: u.account.email, fullName: u.fullName, orgName: u.org.name, roleLabel: ROLE_LABEL_UZ[u.role], hasPassword: !!u.account.passwordHash });
  return true;
}
