import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { orgScope } from "@/lib/scope";

/** Faylni faqat o'sha tashkilotni ko'ra oladigan foydalanuvchi ochadi. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const file = await db.storedFile.findFirst({ where: { id, ...orgScope(user) } });
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(file.size),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
