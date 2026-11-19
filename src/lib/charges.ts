// "server-only" import qilinmaydi: Telegram bot ham shu filtrdan foydalanadigan modullarni chaqiradi.
import type { Prisma } from "@prisma/client";

/**
 * Mijoz qoldig'i va daromadga kiradigan qo'shimcha summalar filtri.
 * Haydovchi aybidagi prostoy hech kimga hisoblanmaydi (05.10.2026 qarori, settlement-core.billableAmounts bilan bir xil qoida).
 */
export const BILLABLE_CHARGES = {
  status: "ACTIVE",
  OR: [{ fault: null }, { fault: "CLIENT" }],
} satisfies Prisma.ShipmentChargeWhereInput;
