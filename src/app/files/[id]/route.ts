import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { orgScope } from "@/lib/scope";
import { isInlineMime } from "@/lib/files";

/** Faylni faqat o'sha tashkilotni ko'ra oladigan foydalanuvchi ochadi. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  // Super Admin tashkilot fayllarini ko'rmaydi — faqat to'lov kvitansiyalarini (17.11.2026).
  const file = user.orgId
    ? await db.storedFile.findFirst({ where: { id, ...orgScope(user) } })
    : user.role === "SUPER_ADMIN" ? await db.storedFile.findFirst({ where: { id, invoice: { isNot: null } } }) : null;
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(file.size),
      // Rasm va PDF brauzerda ochiladi, Office va arxivlar yuklab olinadi.
      "Content-Disposition": `${isInlineMime(file.mime) ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, no-store",
      // Rasmlar "qum qutisi"da ochiladi. PDF'ga sandbox qo'yilmaydi: aks holda brauzerning PDF ko'ruvchisi ishlamaydi
      // (PDF baribir brauzerning alohida ko'ruvchisida, sayt sessiyasidan ajratilgan holda ochiladi).
      ...(file.mime.startsWith("image/") ? { "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'" } : {}),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
