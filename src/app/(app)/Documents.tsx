import type { DocType } from "@prisma/client";
import { getDict, getT } from "@/i18n";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { DRIVER_DOC_TYPES, FILE_REQUIRED, VEHICLE_DOC_TYPES } from "@/lib/docs";
import { ExpiryPill } from "@/components/ExpiryPill";
import { DocsPanel, type DocRow } from "./DocsPanel";

/** Transport yoki haydovchi kartochkasidagi hujjatlar bo'limi. Egasi chaqiruvchida tashkilot filtri bilan tekshirilgan. */
export async function Documents({ owner, canEdit, showArchived }: {
  owner: { kind: "vehicle" | "driver"; id: string };
  canEdit: boolean;
  showArchived: boolean;
}) {
  const [t, d] = [await getT(), await getDict()];
  const docs = await db.document.findMany({
    where: owner.kind === "vehicle" ? { vehicleId: owner.id } : { driverId: owner.id },
    orderBy: [{ type: "asc" }, { createdAt: "desc" }],
    include: { file: { select: { id: true, name: true } } },
  });
  const toRow = (x: (typeof docs)[number]): DocRow => ({
    id: x.id,
    type: x.type,
    typeLabel: t(`doc.t.${x.type}`),
    number: x.number ?? "—",
    issued: formatDate(x.issuedAt),
    expires: formatDate(x.expiresAt),
    pill: x.status === "ACTIVE" ? <ExpiryPill expiresAt={x.expiresAt} t={t} /> : null,
    file: x.file ? { id: x.file.id, name: x.file.name } : null,
    note: x.note,
  });
  const active = docs.filter((x) => x.status === "ACTIVE").map(toRow);
  const archived = docs.filter((x) => x.status !== "ACTIVE").map(toRow);
  const types: DocType[] = [...(owner.kind === "vehicle" ? VEHICLE_DOC_TYPES : DRIVER_DOC_TYPES)];
  return (
    <DocsPanel
      d={d}
      owner={owner}
      types={types}
      fileRequired={[...FILE_REQUIRED]}
      active={active}
      archived={showArchived ? archived : null}
      archivedCount={archived.length}
      canEdit={canEdit}
    />
  );
}
