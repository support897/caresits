import { describe, expect, it } from "vitest";
import {
  bookingSchema,
  calendarEventSchema,
  careSpaceChildSchema,
  careSpaceInviteSchema,
  careSpaceMemberSchema,
  dayStorySchema,
  emergencyContactsSchema,
  medicalRecordSchema,
  notificationPrefsSchema,
  profileCardSchema,
} from "./index.js";

const stamp = new Date("2026-11-04T00:00:00.000Z");

const validBooking = {
  familyUid: "family-1",
  carerUid: "carer-1",
  date: "2026-11-12",
  from: "09:00",
  to: "12:00",
  rate: 32,
  estimate: 96,
  recurring: "none",
  weekdays: [],
  state: "requested",
  createdBy: "family-1",
  createdAt: stamp,
};

describe("shared Firestore schemas", () => {
  it("accepts all new profile-card keys", () => {
    expect(profileCardSchema.safeParse({
      headline: "Gentle and reliable",
      rate: 34,
      budgetMax: 75,
      careTypes: ["babysitter", "nanny"],
      kids: [{ name: "Mia", ageYears: 4 }],
      videoKey: "users/carer-1/intro.webm",
      style: ["outdoors"],
      suburb: "West End",
      instantBook: true,
      lastActive: 1_793_750_400_000,
      weights: { experience: 25, personality: 20, availability: 20, budget: 15, location: 10, activities: 10 },
    }).success).toBe(true);
  });

  it("rejects qualification claims from profile cards", () => {
    expect(profileCardSchema.safeParse({ headline: "Hi", qualifications: ["verified"] }).success).toBe(false);
  });

  it("bounds profile headline length", () => {
    expect(profileCardSchema.safeParse({ headline: "x".repeat(81) }).success).toBe(false);
  });

  it("requires a first name or nickname for each card child", () => {
    expect(profileCardSchema.safeParse({ kids: [{ ageYears: 4 }] }).success).toBe(false);
  });

  it("accepts a family-created requested booking", () => {
    expect(bookingSchema.safeParse(validBooking).success).toBe(true);
  });

  it("rejects unknown booking states", () => {
    expect(bookingSchema.safeParse({ ...validBooking, state: "confirmed" }).success).toBe(false);
  });

  it("rejects malformed booking dates and times", () => {
    expect(bookingSchema.safeParse({ ...validBooking, date: "12/11/2026" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...validBooking, from: "9am" }).success).toBe(false);
  });

  it("rejects a booking where family and carer are the same user", () => {
    expect(bookingSchema.safeParse({ ...validBooking, carerUid: "family-1" }).success).toBe(false);
  });

  it("accepts active members with per-topic permissions", () => {
    expect(careSpaceMemberSchema.safeParse({ role: "limited", status: "active", perms: { allergies: true, medication: false } }).success).toBe(true);
  });

  it("rejects unknown member permission keys", () => {
    expect(careSpaceMemberSchema.safeParse({ role: "viewer", status: "active", perms: { admin: true } }).success).toBe(false);
  });

  it("rejects allergy fields in a child profile", () => {
    expect(careSpaceChildSchema.safeParse({ name: "Mia", allergies: ["peanut"] }).success).toBe(false);
  });

  it("accepts a day-story item with an attached update request", () => {
    expect(dayStorySchema.safeParse({
      childId: "child-1", day: "2026-11-04", kind: "meal", at: stamp, by: "carer-1",
      text: "Had lunch", asks: [{ by: "family-1", text: "Please send a photo", at: stamp }],
    }).success).toBe(true);
  });

  it("accepts a requested time-off calendar event", () => {
    expect(calendarEventSchema.safeParse({
      kind: "timeoff", title: "Day off", start: stamp, end: new Date(stamp.getTime() + 3_600_000),
      ownerUid: "carer-1", state: "requested",
    }).success).toBe(true);
  });

  it("limits the account emergency-contact list to three", () => {
    const contact = { name: "Parent", phone: "+61 400 000 000" };
    expect(emergencyContactsSchema.safeParse({ contacts: [contact, contact, contact] }).success).toBe(true);
    expect(emergencyContactsSchema.safeParse({ contacts: [contact, contact, contact, contact] }).success).toBe(false);
  });

  it("accepts the separated medical record shape", () => {
    expect(medicalRecordSchema.safeParse({
      allergies: [{ name: "Peanut", severity: "severe" }],
      medication: [{ name: "Inhaler", dose: "1 puff", times: ["morning"] }],
      emergency: { contacts: [{ name: "Parent", phone: "+61 400 000 000", relation: "parent" }] },
    }).success).toBe(true);
  });

  it("does not allow invites to grant admin", () => {
    expect(careSpaceInviteSchema.safeParse({
      spaceId: "space-1", role: "admin", createdBy: "owner", createdAt: stamp,
      expiresAt: new Date(stamp.getTime() + 60_000), usedBy: null,
    }).success).toBe(false);
  });

  it("accepts an unexpired non-admin invite", () => {
    expect(careSpaceInviteSchema.safeParse({
      spaceId: "space-1", role: "limited", createdBy: "owner", createdAt: stamp,
      expiresAt: new Date(stamp.getTime() + 60_000), usedBy: null,
    }).success).toBe(true);
  });

  it("uses safe notification defaults and has no safety-alert opt-out", () => {
    const parsed = notificationPrefsSchema.parse({});
    expect(parsed.messages).toBe(true);
    expect(parsed.mode).toBe("all");
    expect(parsed.allergyChanges).toBe(true);
    expect(notificationPrefsSchema.safeParse({ safetyAlerts: false }).success).toBe(false);
  });
});
