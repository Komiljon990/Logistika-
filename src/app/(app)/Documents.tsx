import type { DocType } from "@prisma/client";
import { getDict, getT } from "@/i18n";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { DOC_TYPES, FILE_REQUIRED, missingDocs, type DocOwnerKind } from "@/lib/docs";
import { ExpiryPill } from "@/components/ExpiryPill";
import { DocsPanel, type DocRow } from "./DocsPanel";

/**
 * Transport, haydovchi yoki tashkilot hujjatlari bo'limi.
 * Egasi (va tashkilot uchun orgId) chaqiruvchida tashkilot filtri bilan tekshirilgan bo'lishi shart.
 */
export async function Documents({ owner, canEdit, showArchived }: {
  owner: { kind: DocOwnerKind; id: string };
  canEdit: boolean;
  showArchived: boolean;
}) {
  const [t, d] = [await getT(), await getDict()];
  const where =
    owner.kind === "vehicle"
      ? { vehicleId: owner.id }
      : owner.kind === "driver"
        ? { driverId: owner.id }
        : owner.kind === "trip"
          ? { tripId: owner.id }
          : { orgId: owner.id, vehicleId: null, driverId: null, tripId: null };
  const docs = await db.document.findMany({
    where,
    orderBy: [{ type: "asc" }, { createdAt: "desc" }],
    include: { file: { select: { id: true, name: true } } },
  });
  const toRow = (x: (typeof docs)[number]): DocRow => ({
    id: x.id,
    type: x.type,
    typeLabel: x.title || t(`doc.t.${x.type}`),
    number: x.number ?? "—",
    issued: formatDate(x.issuedAt),
    expires: formatDate(x.expiresAt),
    pill: x.status === "ACTIVE" ? <ExpiryPill expiresAt={x.expiresAt} t={t} /> : null,
    file: x.file ? { id: x.file.id, name: x.file.name } : null,
    note: x.note,
  });
  const activeDocs = docs.filter((x) => x.status === "ACTIVE");
  const archived = docs.filter((x) => x.status !== "ACTIVE").map(toRow);
  const types: DocType[] = [...DOC_TYPES[owner.kind]];
  return (
    <DocsPanel
      d={d}
      owner={owner}
      types={types}
      fileRequired={[...FILE_REQUIRED]}
      missing={missingDocs(owner.kind, activeDocs.map((x) => x.type))}
      active={activeDocs.map(toRow)}
      archived={showArchived ? archived : null}
      archivedCount={archived.length}
      canEdit={canEdit}
    />
  );
}
