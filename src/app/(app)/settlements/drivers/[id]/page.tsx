import { requireSection } from "@/lib/session";
import { LedgerView } from "../../../lessors/LedgerView";

/** Xodim haydovchi: reys uchun / qo'shimcha hisob, to'lovlar va ko'chirma. */
export default async function DriverLedgerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ add?: string }> }) {
  const user = await requireSection("settlements");
  const { id } = await params;
  const { add } = await searchParams;
  return <LedgerView user={user} driverId={id} side="STAFF" add={add === "CHARGE" || add === "PAYMENT" ? add : undefined} />;
}
