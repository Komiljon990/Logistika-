"use client";

import { useSearchParams } from "next/navigation";

/** Demo hisob uchun doimiy eslatma; saqlashga urinilganda (?demo=readonly) alohida ogohlantirish. */
export function DemoNotice({ text, blocked }: { text: string; blocked: string }) {
  const sp = useSearchParams();
  const tried = sp.get("demo") === "readonly";
  return (
    <div role={tried ? "alert" : "status"} className={`px-4 py-2 text-center text-sm ${tried ? "bg-warn text-on-accent font-semibold" : "bg-warn-soft text-warn"}`}>
      {tried ? blocked : text}
    </div>
  );
}
