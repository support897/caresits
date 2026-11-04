import { describe, expect, it } from "vitest";
import { can, defaultPermissionsForRole, isMemberActive, type PermissionAction, type SpaceRole } from "./index";

const actions: PermissionAction[] = [
  "readAllergies", "readMedication", "editMedical", "viewPhotos", "viewCalendar",
  "editCalendar", "readPrivateMessages", "postMessage", "editShopping", "manageTeam",
];

const matrix: Record<SpaceRole, Record<PermissionAction, boolean>> = {
  admin: {
    readAllergies: true, readMedication: true, editMedical: true, viewPhotos: true, viewCalendar: true,
    editCalendar: true, readPrivateMessages: true, postMessage: true, editShopping: true, manageTeam: true,
  },
  regular: {
    readAllergies: true, readMedication: true, editMedical: false, viewPhotos: true, viewCalendar: true,
    editCalendar: true, readPrivateMessages: true, postMessage: true, editShopping: true, manageTeam: false,
  },
  limited: {
    readAllergies: true, readMedication: false, editMedical: false, viewPhotos: false, viewCalendar: true,
    editCalendar: false, readPrivateMessages: false, postMessage: true, editShopping: false, manageTeam: false,
  },
  viewer: {
    readAllergies: false, readMedication: false, editMedical: false, viewPhotos: false, viewCalendar: true,
    editCalendar: false, readPrivateMessages: false, postMessage: false, editShopping: false, manageTeam: false,
  },
};

describe("CareSpace permission matrix", () => {
  it("checks every action for every role against role defaults", () => {
    for (const role of Object.keys(matrix) as SpaceRole[]) {
      const perms = defaultPermissionsForRole(role);
      for (const action of actions) expect(can(role, perms, action), `${role} / ${action}`).toBe(matrix[role][action]);
    }
  });

  it("lets a parent revoke member data access without granting medical edits", () => {
    expect(can("regular", { allergies: false, medication: false, photos: false, calendar: true, privateMessages: false }, "readAllergies")).toBe(false);
    expect(can("regular", { allergies: true, medication: true, photos: true, calendar: true, privateMessages: true }, "editMedical")).toBe(false);
  });

  it("never lets a family viewer read private messages, even if a flag is set", () => {
    expect(can("viewer", { privateMessages: true }, "readPrivateMessages")).toBe(false);
    expect(can("viewer", { privateMessages: true }, "postMessage")).toBe(false);
  });

  it("ends access as soon as member status becomes removed", () => {
    expect(isMemberActive("active")).toBe(true);
    expect(isMemberActive("removed")).toBe(false);
    expect(isMemberActive(undefined)).toBe(false);
  });
});
