"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PostCategory } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { POST_CATEGORIES, slugify } from "@/lib/posts";
import { fail, optStr, str, type FormState } from "@/lib/form";

async function uniqueSlug(base: string, exceptId?: string) {
  let slug = base;
  for (let i = 2; await db.post.findFirst({ where: { slug, ...(exceptId ? { NOT: { id: exceptId } } : {}) } }); i++) slug = `${base}-${i}`;
  return slug;
}

function input(formData: FormData) {
  const title = str(formData, "title").slice(0, 300);
  const body = str(formData, "body").slice(0, 100_000);
  const category = str(formData, "category") as PostCategory;
  if (!title || !body || !POST_CATEGORIES.includes(category)) return null;
  const sourceUrl = optStr(formData, "sourceUrl", 500);
  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) return null;
  return {
    title, body, category, sourceUrl,
    summary: optStr(formData, "summary", 600),
    sourceName: optStr(formData, "sourceName", 200),
    published: formData.get("published") === "on",
  };
}

function refresh() {
  revalidatePath("/admin/site");
  revalidatePath("/site", "layout");
}

/** Sayt maqolasini saqlash (yangi yoki tahrir). Birinchi marta e'lon qilinganda sana qo'yiladi. */
export async function savePost(id: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requirePermission("org.manage");
  const data = input(formData);
  if (!data) return fail("common.required", formData);
  const wanted = slugify(str(formData, "slug") || data.title);
  if (id) {
    const cur = await db.post.findUnique({ where: { id } });
    if (!cur) return fail("common.notFound", formData);
    await db.post.update({
      where: { id },
      data: { ...data, slug: await uniqueSlug(wanted, id), publishedAt: data.published ? (cur.publishedAt ?? new Date()) : cur.publishedAt },
    });
    await audit({ actorId: admin.id, action: "post.update", entity: "Post", entityId: id, details: { title: data.title, published: data.published } });
    refresh();
    return { ok: true };
  }
  const post = await db.post.create({ data: { ...data, slug: await uniqueSlug(wanted), publishedAt: data.published ? new Date() : null, createdById: admin.id } });
  await audit({ actorId: admin.id, action: "post.create", entity: "Post", entityId: post.id, details: { title: data.title } });
  refresh();
  redirect(`/admin/site/${post.id}?saved=1`);
}

export async function deletePost(id: string) {
  const admin = await requirePermission("org.manage");
  const post = await db.post.findUnique({ where: { id } });
  if (!post) return;
  await db.post.delete({ where: { id } });
  await audit({ actorId: admin.id, action: "post.delete", entity: "Post", entityId: id, details: { title: post.title } });
  refresh();
  redirect("/admin/site");
}
