"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { canManageMember, MEMBER_ROLES } from "@/lib/auth-core";
import { addMembership, parseMember, resendInviteFor } from "@/lib/members";
import { fail, type FormState } from "@/lib/form";

export type { FormState };

function parseRole(formData: FormData): Role | null {
  const r = formData.get("role");
  return (MEMBER_ROLES as readonly string[]).includes(String(r)) ? (r as Role) : null;
}

/** Rahbar: o'z tashkilotiga menejer, buxgalter yoki ishonchli vakil qo'shadi. Parolni xodim o'zi o'rnatadi. */
export async function addMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requirePermission("team.manage");
  if (!me.orgId) return fail("user.error.org", formData);
  const role = parseRole(formData);
  const v = parseMember(formData);
  if (!role) return fail("common.required", formData);
  if ("error" in v) return fail(v.error, formData);
  const res = await addMembership({ orgId: me.orgId, role, input: v.data, actorId: me.id, formData });
  if (!res.ok) return res;
  redirect(`/team/${res.id}?added=1`);
}

async function managed(id: string) {
  const me = await requirePermission("team.manage");
  const target = await db.user.findUnique({ where: { id } });
  if (!target || !canManageMember(me, target)) return null;
  return { me, target };
}

/** F.I.O., telefon (aloqa uchun) va rol. E-mail — shaxsning logini, uni rahbar o'zgartirmaydi. */
export async function updateMember(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const m = await managed(id);
  if (!m) return { error: "user.error.forbidden" };
  const role = parseRole(formData);
  const v = parseMember(formData, false);
  if (!role) return fail("common.required", formData);
  if ("error" in v) return fail(v.error, formData);
  await db.user.update({
    where: { id },
    data: { fullName: v.data.fullName, phone: v.data.phone, role, ...(role !== m.target.role ? { sessionVersion: { increment: 1 } } : {}) },
  });
  await audit({
    actorId: m.me.id, orgId: m.me.orgId, action: "team.update", entity: "User", entityId: id,
    details: { from: { role: m.target.role, fullName: m.target.fullName }, to: { role, fullName: v.data.fullName } },
  });
  revalidatePath(`/team/${id}`);
  return { ok: true };
}

export async function setMemberStatus(id: string, active: boolean): Promise<void> {
  const m = await managed(id);
  if (!m) return;
  await db.user.update({ where: { id }, data: { status: active ? "ACTIVE" : "BLOCKED", sessionVersion: { increment: 1 } } });
  await audit({ actorId: m.me.id, orgId: m.me.orgId, action: "team.status", entity: "User", entityId: id, details: { status: active ? "ACTIVE" : "BLOCKED" } });
  revalidatePath(`/team/${id}`);
  revalidatePath("/team");
}

export async function resendInvite(id: string, _prev: FormState): Promise<FormState> {
  const m = await managed(id);
  if (!m) return { error: "user.error.forbidden" };
  return (await resendInviteFor(id)) ? { ok: true } : { error: "user.error.forbidden" };
}
