import { requireSection } from "@/lib/session";
import { LedgerView } from "../LedgerView";

/** Ijarachi (o'z transportidagi haydovchi): transportlari, qarz, "+ Hisob qo'shish", "+ To'lov", ko'chirma. */
export default async function LessorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ add?: string }> }) {
  const user = await requireSection("lessors");
  const { id } = await params;
  const { add } = await searchParams;
  return <LedgerView user={user} driverId={id} side="LESSOR" add={add === "CHARGE" || add === "PAYMENT" ? add : undefined} />;
}
