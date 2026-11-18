import { requireUser } from "@/lib/session";
import { buildXlsx } from "@/lib/xlsx";
import { IMPORT_KINDS, TEMPLATE, type ImportKind } from "@/lib/import-core";

/** Import shabloni (.xlsx): sarlavhalar va namuna qatorlari. */
export async function GET(req: Request) {
  await requireUser();
  const kind = new URL(req.url).searchParams.get("kind") as ImportKind;
  if (!IMPORT_KINDS.includes(kind)) return new Response("Not found", { status: 404 });
  const bytes = buildXlsx(TEMPLATE[kind], kind);
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="reyspro-${kind}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
