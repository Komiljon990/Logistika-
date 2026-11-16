"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Status } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireSection } from "@/lib/session";
import { orgForWrite, orgScope, ForbiddenError } from "@/lib/scope";
import { fail, optStr, str, type FormState } from "@/lib/form";

async function editor() {
  const user = await requireSection("clients", "EDIT");
  return { user, orgId: orgForWrite(user) };
}

function clientInput(formData: FormData) {
  const name = str(formData, "name").slice(0, 200);
  if (!name) return null;
  return {
    name,
    inn: optStr(formData, "inn", 20),
    phone: optStr(formData, "phone", 40),
    address: optStr(formData, "address", 300),
    note: optStr(formData, "note"),
  };
}

export async function createClient(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await editor();
  const data = clientInput(formData);
  if (!data) return fail("common.required", formData);
  const c = await db.client.create({ data: { ...data, orgId } });
  await audit({ actorId: user.id, orgId, action: "client.create", entity: "Client", entityId: c.id, details: { name: c.name } });
  redirect(`/clients/${c.id}`);
}

export async function updateClient(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user, orgId } = await editor();
  if (!(await db.client.findFirst({ where: { id, ...orgScope(user) } }))) throw new ForbiddenError();
  const data = clientInput(formData);
  if (!data) return fail("common.required", formData);
  await db.client.update({ where: { id }, data });
  await audit({ actorId: user.id, orgId, action: "client.update", entity: "Client", entityId: id, details: data });
  revalidatePath(`/clients/${id}`);
  return { ok: true };
}

export async function setClientStatus(id: string, status: Status) {
  const { user, orgId } = await editor();
  if (status !== "ACTIVE" && status !== "ARCHIVED") return;
  if (!(await db.client.findFirst({ where: { id, ...orgScope(user) } }))) throw new ForbiddenError();
  await db.client.update({ where: { id }, data: { status } });
  await audit({ actorId: user.id, orgId, action: "client.status", entity: "Client", entityId: id, details: { status } });
  revalidatePath(`/clients/${id}`);
}
