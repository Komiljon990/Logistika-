import { describe, expect, it } from "vitest";
import {
  methodAllowed, shipmentTotals, payStatus, demurrage, billableAmounts, consumedFor, checkAllocations, autoAllocate, clientBalance,
  type OpenShipment,
} from "@/lib/settlement-core";

const open = (list: OpenShipment[]) => new Map(list.map((s) => [s.id, s]));

describe("terms and methods", () => {
  it("contract — bank only; cash terms — cash or card", () => {
    expect(methodAllowed("BANK", "CONTRACT")).toBe(true);
    expect(methodAllowed("CASH", "CONTRACT")).toBe(false);
    expect(methodAllowed("CARD", "CONTRACT")).toBe(false);
    expect(methodAllowed("CASH", "CASH")).toBe(true);
    expect(methodAllowed("CARD", "CASH")).toBe(true);
    expect(methodAllowed("BANK", "CASH")).toBe(false);
  });
});

describe("shipment remaining (TZ formula)", () => {
  it("price + extra + demurrage − payments", () => {
    const t = shipmentTotals(3000, [150, demurrage(2, 50)], [2000]);
    expect(t).toEqual({ charged: 3250, paid: 2000, remaining: 1250 });
    expect(payStatus(t.charged, t.paid)).toBe("PARTIAL");
    expect(payStatus(3250, 0)).toBe("UNPAID");
    expect(payStatus(3250, 3250)).toBe("PAID");
  });
  it("driver-fault demurrage is charged to nobody; old demurrage without fault stays billable", () => {
    const charges = [
      { amount: 150 }, // qo'shimcha xarajat
      { amount: demurrage(2, 50), fault: "CLIENT" },
      { amount: demurrage(3, 50), fault: "DRIVER" },
      { amount: 40, fault: null }, // sababi yozilmagan eski prostoy
    ];
    expect(billableAmounts(charges)).toEqual([150, 100, 40]);
    expect(shipmentTotals(3000, billableAmounts(charges), [3290])).toEqual({ charged: 3290, paid: 3290, remaining: 0 });
  });
  it("demurrage = days × daily", () => {
    expect(demurrage(3, 66.67)).toBe(200.01);
  });
});

describe("cross-currency payment (3500 USD agreed, paid in so'm)", () => {
  it("45 000 000 UZS at 12 850 closes 3 501.94 USD, never more than received", () => {
    // 3 501.95 USD = 45 000 057.50 so'm — kelgan puldan ko'p bo'lardi, shuning uchun pastga yaxlitlanadi.
    expect(consumedFor(3501.95, 12850)).toBe(45000057.5);
    const ships = open([{ id: "a", currency: "USD", remaining: 3000, terms: "CONTRACT", order: 0 }, { id: "b", currency: "USD", remaining: 1250, terms: "CONTRACT", order: 1 }]);
    const alloc = autoAllocate(45_000_000, "BANK", [...ships.values()], (c) => (c === "USD" ? 12850 : null));
    expect(alloc).toEqual([
      { shipmentId: "a", applied: 3000, rate: 12850 },
      { shipmentId: "b", applied: 501.94, rate: 12850 },
    ]);
    const check = checkAllocations(45_000_000, "BANK", alloc, ships);
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.advance).toBe(71); // 45 000 000 − 44 999 929 so'm avansga
  });
  it("manual (agreed) rate is respected", () => {
    const ships = open([{ id: "a", currency: "USD", remaining: 3500, terms: "CONTRACT", order: 0 }]);
    const check = checkAllocations(44_800_000, "BANK", [{ shipmentId: "a", applied: 3500, rate: 12800 }], ships);
    expect(check).toEqual({ ok: true, consumed: [44_800_000], advance: 0 });
  });
});

describe("allocation checks", () => {
  const ships = open([
    { id: "c", currency: "USD", remaining: 1000, terms: "CONTRACT", order: 0 },
    { id: "n", currency: "EUR", remaining: 500, terms: "CASH", order: 1 },
  ]);
  it("leftover becomes advance", () => {
    expect(checkAllocations(1500, "BANK", [{ shipmentId: "c", applied: 1000, rate: 1 }], ships)).toEqual({ ok: true, consumed: [1000], advance: 500 });
    expect(checkAllocations(700, "BANK", [], ships)).toEqual({ ok: true, consumed: [], advance: 700 });
  });
  it("rejects wrong method, over-allocation, exceeding amount, bad rate", () => {
    expect(checkAllocations(500, "BANK", [{ shipmentId: "n", applied: 500, rate: 1 }], ships)).toMatchObject({ error: "pay.error.method" });
    expect(checkAllocations(2000, "BANK", [{ shipmentId: "c", applied: 1200, rate: 1 }], ships)).toMatchObject({ error: "pay.error.over" });
    expect(checkAllocations(900, "BANK", [{ shipmentId: "c", applied: 1000, rate: 1 }], ships)).toMatchObject({ error: "pay.error.exceed" });
    expect(checkAllocations(900, "BANK", [{ shipmentId: "c", applied: 100, rate: 0 }], ships)).toMatchObject({ error: "pay.error.rate" });
    expect(checkAllocations(0, "BANK", [], ships)).toMatchObject({ error: "pay.error.amount" });
    expect(checkAllocations(900, "BANK", [{ shipmentId: "zzz", applied: 1, rate: 1 }], ships)).toMatchObject({ error: "pay.error.method" });
  });
  it("auto-allocation skips shipments of another payment method", () => {
    expect(autoAllocate(800, "CASH", [...ships.values()], () => 1)).toEqual([{ shipmentId: "n", applied: 500, rate: 1 }]);
  });
});

describe("client balance", () => {
  it("per currency, advance reduces debt; currencies never mix", () => {
    const b = clientBalance(
      [{ currency: "USD", charged: 12250, paid: 7000 }, { currency: "UZS", charged: 21_500_000, paid: 0 }],
      [{ currency: "USD", advance: 500 }, { currency: "EUR", advance: 0 }],
    );
    expect(b.USD).toEqual({ charged: 12250, paid: 7000, advance: 500, debt: 4750 });
    expect(b.UZS.debt).toBe(21_500_000);
    expect(b.EUR).toBeUndefined();
  });
});
