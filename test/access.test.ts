import { describe, expect, it } from "vitest";
import { accessFromForm, canEdit, canView, nextSpecialistNo, parseAccess, roleTitle, sectionLevel } from "@/lib/access";

describe("Mutaxassis huquqlari", () => {
  const spec = { role: "SPECIALIST" as const, access: { tir: "EDIT" as const, trips: "VIEW" as const } };

  it("faqat belgilangan bo'limlar: TIR — tahrirlash, tashishlar — ko'rish, qolgani yopiq", () => {
    expect(canEdit(spec, "tir")).toBe(true);
    expect(canView(spec, "trips")).toBe(true);
    expect(canEdit(spec, "trips")).toBe(false);
    expect(canView(spec, "cash")).toBe(false);
    expect(canView(spec, "clients")).toBe(false);
    expect(sectionLevel({ role: "SPECIALIST", access: null }, "tir")).toBeNull();
  });

  it("boshqa rollar avvalgidek", () => {
    expect(canEdit({ role: "MANAGER" }, "trips")).toBe(true);
    expect(canEdit({ role: "DIRECTOR" }, "trips")).toBe(false);
    expect(canView({ role: "DIRECTOR" }, "trips")).toBe(true);
    expect(canEdit({ role: "ACCOUNTANT" }, "cash")).toBe(true);
    expect(canEdit({ role: "DIRECTOR" }, "orgdocs")).toBe(true);
    expect(canEdit({ role: "MANAGER" }, "reports")).toBe(false);
    expect(canView({ role: "SUPER_ADMIN" }, "trips")).toBe(false);
  });

  it("bazadan o'qish faqat ma'lum qiymatlarni oladi", () => {
    expect(parseAccess({ tir: "EDIT", cash: "ADMIN", hack: "EDIT", trips: "VIEW" })).toEqual({ tir: "EDIT", trips: "VIEW" });
    expect(parseAccess(null)).toEqual({});
  });

  it("formadan: belgi + daraja", () => {
    const fd = new FormData();
    fd.set("acc_tir", "on"); fd.set("lvl_tir", "EDIT");
    fd.set("acc_trips", "on");
    fd.set("lvl_cash", "EDIT"); // belgisiz — hisobga olinmaydi
    expect(accessFromForm(fd)).toEqual({ tir: "EDIT", trips: "VIEW" });
  });

  it("raqamlash: Mutaxassis-1, -2 …", () => {
    expect(nextSpecialistNo([])).toBe(1);
    expect(nextSpecialistNo([1, null, 3])).toBe(4);
    const t = (k: string) => (k === "role.SPECIALIST" ? "Mutaxassis" : k);
    expect(roleTitle(t, { role: "SPECIALIST", specialistNo: 2 })).toBe("Mutaxassis-2");
  });
});
