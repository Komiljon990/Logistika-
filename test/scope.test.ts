import { describe, expect, it } from "vitest";
import { orgScope, orgForWrite, assertCanSeeOrg, ForbiddenError, seesAllOrgs } from "@/lib/scope";
import { can } from "@/lib/roles";

const manager = { id: "m", role: "MANAGER" as const, orgId: "orgA" };
const director = { id: "d", role: "DIRECTOR" as const, orgId: "orgA" };
const accountant = { id: "a", role: "ACCOUNTANT" as const, orgId: "orgA" };
const admin = { id: "s", role: "SUPER_ADMIN" as const, orgId: null };

describe("orgScope", () => {
  it("ignores another org requested by a member", () => {
    expect(orgScope(manager, "orgB")).toEqual({ orgId: "orgA" });
    expect(orgScope(director, "orgB")).toEqual({ orgId: "orgA" });
    expect(orgScope(accountant, "orgB")).toEqual({ orgId: "orgA" });
  });
  it("gives super admin (no org) no org data at all", () => {
    expect(() => orgScope(admin)).toThrow(ForbiddenError);
    expect(() => orgScope(admin, "orgB")).toThrow(ForbiddenError);
    expect(() => orgForWrite(admin, "orgB")).toThrow(ForbiddenError);
    expect(() => assertCanSeeOrg(admin, "orgB")).toThrow(ForbiddenError);
  });
  it("nobody sees all orgs any more", () => {
    for (const u of [manager, director, accountant, admin]) expect(seesAllOrgs(u)).toBe(false);
  });
});

describe("orgForWrite / assertCanSeeOrg", () => {
  it("writes members into their own org only", () => {
    expect(orgForWrite(manager, "orgB")).toBe("orgA");
  });
  it("blocks reading another org's record", () => {
    expect(() => assertCanSeeOrg(manager, "orgB")).toThrow(ForbiddenError);
    expect(() => assertCanSeeOrg(manager, "orgA")).not.toThrow();
    expect(() => assertCanSeeOrg(accountant, "orgB")).toThrow(ForbiddenError);
  });
});

describe("permissions", () => {
  it("director and deputy only view data", () => {
    for (const r of ["DIRECTOR", "DEPUTY"] as const) {
      expect(can(r, "data.view")).toBe(true);
      expect(can(r, "data.edit")).toBe(false);
      expect(can(r, "admin.access")).toBe(false);
    }
  });
  it("super admin manages orgs and directors but sees no org data", () => {
    expect(can("SUPER_ADMIN", "org.manage")).toBe(true);
    expect(can("SUPER_ADMIN", "user.manage")).toBe(true);
    expect(can("SUPER_ADMIN", "data.view")).toBe(false);
    expect(can("SUPER_ADMIN", "data.edit")).toBe(false);
    expect(can("SUPER_ADMIN", "team.manage")).toBe(false);
  });
  it("only the director manages staff", () => {
    expect(can("DIRECTOR", "team.manage")).toBe(true);
    for (const r of ["ACCOUNTANT", "MANAGER", "DEPUTY"] as const) {
      expect(can(r, "team.manage")).toBe(false);
      expect(can(r, "user.manage")).toBe(false);
      expect(can(r, "hard.delete")).toBe(false);
    }
  });
});
