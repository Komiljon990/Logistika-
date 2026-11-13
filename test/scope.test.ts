import { describe, expect, it } from "vitest";
import { orgScope, orgForWrite, assertCanSeeOrg, ForbiddenError, seesAllOrgs } from "@/lib/scope";
import { can } from "@/lib/roles";

const manager = { id: "m", role: "MANAGER" as const, orgId: "orgA" };
const director = { id: "d", role: "DIRECTOR" as const, orgId: "orgA" };
const accountant = { id: "a", role: "ACCOUNTANT" as const, orgId: null };
const admin = { id: "s", role: "SUPER_ADMIN" as const, orgId: null };

describe("orgScope", () => {
  it("ignores another org requested by an org-bound user", () => {
    expect(orgScope(manager, "orgB")).toEqual({ orgId: "orgA" });
    expect(orgScope(director, "orgB")).toEqual({ orgId: "orgA" });
  });
  it("lets global roles see all orgs or filter to one", () => {
    expect(orgScope(accountant)).toEqual({});
    expect(orgScope(admin, "orgB")).toEqual({ orgId: "orgB" });
  });
  it("refuses an org-bound user without an org", () => {
    expect(() => orgScope({ id: "x", role: "MANAGER", orgId: null })).toThrow(ForbiddenError);
  });
});

describe("demo / org-bound global role", () => {
  const demoAccountant = { id: "da", role: "ACCOUNTANT" as const, orgId: "demoOrg" };
  it("an accountant bound to an org sees only that org, whatever is requested", () => {
    expect(orgScope(demoAccountant)).toEqual({ orgId: "demoOrg" });
    expect(orgScope(demoAccountant, "realOrg")).toEqual({ orgId: "demoOrg" });
    expect(orgForWrite(demoAccountant, "realOrg")).toBe("demoOrg");
    expect(() => assertCanSeeOrg(demoAccountant, "realOrg")).toThrow(ForbiddenError);
    expect(seesAllOrgs(demoAccountant)).toBe(false);
  });
  it("normal accountant and super admin still see all orgs", () => {
    expect(seesAllOrgs(accountant)).toBe(true);
    expect(seesAllOrgs(admin)).toBe(true);
    expect(seesAllOrgs(manager)).toBe(false);
  });
});

describe("orgForWrite / assertCanSeeOrg", () => {
  it("writes org-bound users into their own org only", () => {
    expect(orgForWrite(manager, "orgB")).toBe("orgA");
  });
  it("requires global roles to pick an org", () => {
    expect(() => orgForWrite(accountant)).toThrow(ForbiddenError);
  });
  it("blocks reading another org's record", () => {
    expect(() => assertCanSeeOrg(manager, "orgB")).toThrow(ForbiddenError);
    expect(() => assertCanSeeOrg(manager, "orgA")).not.toThrow();
    expect(() => assertCanSeeOrg(accountant, "orgB")).not.toThrow();
  });
});

describe("permissions", () => {
  it("director and deputy only view", () => {
    for (const r of ["DIRECTOR", "DEPUTY"] as const) {
      expect(can(r, "data.view")).toBe(true);
      expect(can(r, "data.edit")).toBe(false);
      expect(can(r, "admin.access")).toBe(false);
    }
  });
  it("only super admin manages users and hard-deletes", () => {
    for (const r of ["ACCOUNTANT", "MANAGER", "DIRECTOR", "DEPUTY"] as const) {
      expect(can(r, "user.manage")).toBe(false);
      expect(can(r, "hard.delete")).toBe(false);
    }
    expect(can("SUPER_ADMIN", "user.manage")).toBe(true);
  });
});
