import { describe, expect, it } from "vitest";
import { can, canResetPassword } from "@/lib/roles";

const admin = { id: "s", role: "SUPER_ADMIN" as const, orgId: null };
const admin2 = { id: "s2", role: "SUPER_ADMIN" as const, orgId: null };
const accountant = { id: "a", role: "ACCOUNTANT" as const, orgId: null };
const directorA = { id: "dA", role: "DIRECTOR" as const, orgId: "orgA" };
const directorA2 = { id: "dA2", role: "DIRECTOR" as const, orgId: "orgA" };
const directorB = { id: "dB", role: "DIRECTOR" as const, orgId: "orgB" };
const managerA = { id: "mA", role: "MANAGER" as const, orgId: "orgA" };
const deputyA = { id: "vA", role: "DEPUTY" as const, orgId: "orgA" };
const managerB = { id: "mB", role: "MANAGER" as const, orgId: "orgB" };

describe("canResetPassword", () => {
  it("super admin resets anyone except themselves", () => {
    for (const target of [accountant, directorA, managerA, deputyA, managerB, admin2]) {
      expect(canResetPassword(admin, target), target.id).toBe(true);
    }
    expect(canResetPassword(admin, admin)).toBe(false);
  });

  it("director resets manager and deputy of their own org", () => {
    expect(canResetPassword(directorA, managerA)).toBe(true);
    expect(canResetPassword(directorA, deputyA)).toBe(true);
  });

  it("director cannot reset another org's users", () => {
    expect(canResetPassword(directorA, managerB)).toBe(false);
    expect(canResetPassword(directorB, managerA)).toBe(false);
  });

  it("only super admin resets directors (including the director's own password)", () => {
    expect(canResetPassword(directorA, directorA2)).toBe(false);
    expect(canResetPassword(directorA, directorA)).toBe(false);
    expect(canResetPassword(admin, directorA)).toBe(true);
  });

  it("all-org users (accountant, super admin) are reset only by super admin", () => {
    expect(canResetPassword(directorA, accountant)).toBe(false);
    expect(canResetPassword(directorA, admin)).toBe(false);
  });

  it("director without an org resets nobody", () => {
    const orphan = { id: "x", role: "DIRECTOR" as const, orgId: null };
    expect(canResetPassword(orphan, { id: "y", role: "MANAGER", orgId: null })).toBe(false);
  });

  it("other roles reset nobody", () => {
    for (const actor of [accountant, managerA, deputyA]) {
      expect(canResetPassword(actor, managerA.id === actor.id ? deputyA : managerA)).toBe(false);
    }
  });

  it("team page is for directors only", () => {
    expect(can("DIRECTOR", "team.view")).toBe(true);
    for (const r of ["SUPER_ADMIN", "ACCOUNTANT", "MANAGER", "DEPUTY"] as const) expect(can(r, "team.view")).toBe(false);
  });
});
