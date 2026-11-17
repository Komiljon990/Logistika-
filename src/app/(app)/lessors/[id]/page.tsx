import { requireSection } from "@/lib/session";
import { LedgerView } from "../LedgerView";

/** Ijarachi (o'z transportidagi haydovchi): transportlari, qarz, "+ Hisob qo'shish", "+ To'lov", ko'chirma. */
export default async function LessorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSection("lessors");
  const { id } = await params;
  return <LedgerView user={user} driverId={id} side="LESSOR" />;
}
