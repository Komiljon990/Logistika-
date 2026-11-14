"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, assertWritable } from "@/lib/session";
import { ForbiddenError } from "@/lib/scope";
import { activityWhere, UNDOABLE } from "@/lib/activity";
import { cancelCharge, cancelPayment } from "../settlements/actions";
import { cancelTrip } from "../trips/actions";
import { setClientStatus } from "../clients/actions";
import { archiveDocument, setDriverStatus, setVehicleStatus } from "../fleet-actions";
import { cancelExpense, cancelTransfer, setAccountStatus } from "../cash/actions";

/**
 * "Oxirgi amallar"dan o'chirish: yaratilgan yozuv bekor qilinadi (bazadan o'chmaydi, tarix saqlanadi).
 * Foydalanuvchi faqat o'zi ko'ra oladigan amalni tanlay oladi; huquq esa har bir amalning o'zida qayta tekshiriladi.
 */
export async function undoActivity(auditId: string): Promise<{ ok?: boolean; error?: "act.error.undo" }> {
  const user = await requireUser();
  await assertWritable(user);
  const log = await db.auditLog.findFirst({ where: { id: auditId, ...activityWhere(user, false) } });
  if (!log || !(log.action in UNDOABLE)) throw new ForbiddenError();
  const id = log.entityId;
  let r: unknown;
  switch (log.action as keyof typeof UNDOABLE) {
    case "payment.create": r = await cancelPayment(id); break;
    case "charge.create": r = await cancelCharge(id); break;
    case "trip.create": r = await cancelTrip(id); break;
    case "client.create": await setClientStatus(id, "ARCHIVED"); break;
    case "vehicle.create": await setVehicleStatus(id, "ARCHIVED"); break;
    case "driver.create": await setDriverStatus(id, "ARCHIVED"); break;
    case "document.create":
    case "document.renew": await archiveDocument(id); break;
    case "expense.create": r = await cancelExpense(id); break;
    case "transfer.create": r = await cancelTransfer(id); break;
    case "account.create": r = await setAccountStatus(id, "ARCHIVED"); break;
  }
  revalidatePath("/activity");
  if (r && typeof r === "object" && "error" in r && r.error) return { error: "act.error.undo" };
  return { ok: true };
}
