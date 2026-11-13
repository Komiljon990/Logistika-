import { describe, expect, it } from "vitest";
import {
  nextEvents, checkEvent, completesTrip, isLoaded, currentStage, tripNumber,
  parseTashkentDateTime, formatTashkent, normalizeContactPhone, type DoneEvents,
} from "@/lib/trips-core";
import { DOC_TYPES, RECOMMENDED } from "@/lib/docs";

const at = (s: string) => new Date(`${s}:00Z`);
const NOW = at("2026-11-13T12:00");

describe("trip stages order", () => {
  it("starts with 'accepted' only", () => {
    expect(nextEvents({})).toEqual(["ACCEPTED"]);
  });
  it("offers border exit after loading, alongside the next stage", () => {
    const done: DoneEvents = { ACCEPTED: at("2026-11-01T08:00"), ARRIVED_LOADING: at("2026-11-01T10:00"), LOADED: at("2026-11-01T14:00") };
    expect(nextEvents(done)).toEqual(["EXITED_UZ", "ARRIVED_UNLOADING"]);
  });
  it("offers border entry only after exit and unloading", () => {
    const base: DoneEvents = {
      ACCEPTED: at("2026-11-01T08:00"), ARRIVED_LOADING: at("2026-11-01T10:00"), LOADED: at("2026-11-01T14:00"),
      ARRIVED_UNLOADING: at("2026-11-05T10:00"), UNLOADED: at("2026-11-05T15:00"),
    };
    expect(nextEvents(base)).toEqual([]); // ichki tashish: hammasi tugadi
    expect(nextEvents({ ...base, EXITED_UZ: at("2026-11-02T09:00") })).toEqual(["ENTERED_UZ"]);
  });
  it("rejects skipping stages", () => {
    expect(checkEvent("LOADED", at("2026-11-01T10:00"), {}, NOW)).toEqual({ ok: false, error: "trip.error.order" });
    expect(checkEvent("ENTERED_UZ", at("2026-11-01T10:00"), { ACCEPTED: at("2026-11-01T08:00") }, NOW)).toMatchObject({ ok: false });
  });
  it("rejects a time before the previous stage, and the future", () => {
    const done: DoneEvents = { ACCEPTED: at("2026-11-01T08:00") };
    expect(checkEvent("ARRIVED_LOADING", at("2026-11-01T07:00"), done, NOW)).toEqual({ ok: false, error: "trip.error.time" });
    expect(checkEvent("ARRIVED_LOADING", at("2026-11-14T07:00"), done, NOW)).toEqual({ ok: false, error: "trip.error.future" });
    expect(checkEvent("ARRIVED_LOADING", at("2026-11-01T09:00"), done, NOW)).toEqual({ ok: true });
  });
});

describe("vehicle availability and completion", () => {
  const unloaded: DoneEvents = { ACCEPTED: NOW, ARRIVED_LOADING: NOW, LOADED: NOW, ARRIVED_UNLOADING: NOW, UNLOADED: NOW };
  it("vehicle is loaded until 'unloaded', then free even before returning", () => {
    expect(isLoaded("ACTIVE", {})).toBe(true);
    expect(isLoaded("ACTIVE", { ACCEPTED: NOW, LOADED: NOW })).toBe(true);
    expect(isLoaded("ACTIVE", { ...unloaded, EXITED_UZ: NOW })).toBe(false);
    expect(isLoaded("CANCELLED", {})).toBe(false);
  });
  it("domestic trip completes on unloading, international on entering Uzbekistan", () => {
    expect(completesTrip(unloaded)).toBe(true);
    expect(completesTrip({ ...unloaded, EXITED_UZ: NOW })).toBe(false);
    expect(completesTrip({ ...unloaded, EXITED_UZ: NOW, ENTERED_UZ: NOW })).toBe(true);
  });
  it("current stage is the latest one", () => {
    expect(currentStage({})).toBeNull();
    expect(currentStage({ ACCEPTED: NOW, LOADED: NOW, EXITED_UZ: NOW })).toBe("EXITED_UZ");
  });
});

describe("formats", () => {
  it("trip number", () => {
    expect(tripNumber(7)).toBe("TSH-0007");
    expect(tripNumber(12345)).toBe("TSH-12345");
  });
  it("Tashkent local time round trip", () => {
    const d = parseTashkentDateTime("2026-11-13T09:30")!;
    expect(d.toISOString()).toBe("2026-11-13T04:30:00.000Z");
    expect(formatTashkent(d)).toBe("13.11.2026 09:30");
    expect(parseTashkentDateTime("13.11.2026 09:30")).toBeNull();
  });
  it("contact phone: Uzbek and foreign numbers", () => {
    expect(normalizeContactPhone("90 123 45 67")).toBe("+998901234567");
    expect(normalizeContactPhone("+48 600 123 456")).toBe("+48600123456");
    expect(normalizeContactPhone("12")).toBeNull();
  });
  it("trip documents: waybill, CMR, Dazvol, TIR", () => {
    expect(DOC_TYPES.trip).toEqual(["WAYBILL", "CMR", "DAZVOL", "TIR_CARNET", "OTHER"]);
    expect(RECOMMENDED.trip).toEqual(["WAYBILL", "CMR"]);
  });
});
