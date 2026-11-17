import { requireSection } from "@/lib/session";
import { LedgerView } from "../../../lessors/LedgerView";

/** Xodim haydovchi: reys uchun / qo'shimcha hisob, to'lovlar va ko'chirma. */
export default async function DriverLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSection("settlements");
  const { id } = await params;
  return <LedgerView user={user} driverId={id} side="STAFF" />;
}
