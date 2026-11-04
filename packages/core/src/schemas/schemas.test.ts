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
  mealPlanSchema,
  notificationPrefsSchema,
  profileCardSchema,
  profileSchema,
  profileWriteSchema,
  shoppingItemSchema,
  userSpaceIndexSchema,
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

  it("validates family, carer, gallery, and au-pair profile extras", () => {
    expect(profileCardSchema.safeParse({
      parentNames: ["Ari", "Sam"],
      householdPrefs: { pets: true, smoking: false, languagesAtHome: ["English"], houseRules: "Shoes off" },
      essentials: { schedule: "essential", budget: "flexible", minAgeGroupsOk: true },
      ageGroups: ["newborn", "school"],
      idealFamily: "Clear, kind communication",
      gallery: ["users/carer-1/gallery/one.jpg"],
      mainPhotoIndex: 0,
      auPair: {
        destinations: ["Australia"], durationMonths: 12, preferredAges: ["infant"],
        ageGroups: ["infant"], accommodation: "Private room", pocketMoneyExpectation: "A$300 weekly",
        culturalInterests: ["Cooking"], expectations: "Respectful communication",
      },
      auPairHost: {
        country: "Australia", room: "Private room", accommodation: "Private bedroom",
        meals: "Meals included", daysOff: ["Sat", "Sun"], location: { city: "Brisbane" },
        expectations: "Shared family meals", durationMonths: 12, pocketMoneyPerWeek: 320,
        hoursPerWeek: 25, childcareDuties: ["School pickup"], otherHousework: ["Own laundry"],
        languages: ["English"], visaSupport: true, visaHelp: true, infantCareNeeded: false,
      },
    }).success).toBe(true);
    expect(profileCardSchema.safeParse({ parentNames: ["A", "B", "C", "D", "E"] }).success).toBe(false);
    expect(profileCardSchema.safeParse({ gallery: ["spaces/space-1/photo.jpg"] }).success).toBe(false);
    expect(profileSchema.safeParse({ side: "carer", displayName: "Carer", card: { gallery: ["users/carer-1/photo.jpg"], mainPhotoIndex: 1 } }).success).toBe(false);
    expect(profileCardSchema.safeParse({ auPair: { durationMonths: 37 } }).success).toBe(false);
    expect(profileWriteSchema.safeParse({ reviewsSummary: { count: 1, avg: 5 } }).success).toBe(false);
  });

  it("accepts au-pair host, second-side, and experience card data", () => {
    expect(profileCardSchema.safeParse({
      experienceYears: 4,
      photoUrl: "users/host-1/profile.webp",
      auPairHost: {
        country: "Australia", room: "Private room", pocketMoneyPerWeek: 320, hoursPerWeek: 25,
        childcareDuties: ["school pickup"], otherHousework: ["laundry"], languages: ["English"],
        visaHelp: true, infantCareNeeded: false,
      },
      alsoSide: { side: "carer", headline: "Warm carer", experienceYears: 4, careTypes: ["nanny"] },
    }).success).toBe(true);
    expect(profileCardSchema.safeParse({ auPairHost: { country: "Australia", admin: true } }).success).toBe(false);
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

  it("accepts a completed timeline ask reply", () => {
    expect(dayStorySchema.safeParse({
      childId: "child-1", day: "2026-11-04", kind: "activity", at: stamp, by: "carer-1", text: "Painting",
      asks: [{ by: "family-1", text: "Share a photo", at: stamp, answeredAt: stamp, answerText: "Done", answerPhotoKey: "spaces/family/painting.webp" }],
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
    expect(emergencyContactsSchema.safeParse({ contacts: [contact, contact, contact], updatedAt: stamp }).success).toBe(true);
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

  it("accepts targeted booking invites with a permission snapshot", () => {
    expect(careSpaceInviteSchema.safeParse({
      spaceId: "family-1", role: "regular", createdBy: "family-1", createdAt: stamp,
      expiresAt: new Date(stamp.getTime() + 60_000), usedBy: null,
      perms: { allergies: false, medication: false, photos: false, calendar: false, privateMessages: false },
      targetUid: "carer-1", bookingId: "booking-1",
    }).success).toBe(true);
    expect(careSpaceInviteSchema.safeParse({
      spaceId: "family-1", role: "regular", createdBy: "family-1", createdAt: stamp,
      expiresAt: new Date(stamp.getTime() + 60_000), usedBy: null, targetUid: "carer-1",
    }).success).toBe(false);
  });

  it("checks app-owned space index, meal plan, and shopping shapes", () => {
    expect(userSpaceIndexSchema.safeParse({ spaceId: "family-1", name: "Family", memberRole: "admin", joinedAt: stamp }).success).toBe(true);
    expect(mealPlanSchema.safeParse({ meals: [{ childId: "child-1", name: "Soup", ingredients: ["carrot"] }] }).success).toBe(true);
    expect(shoppingItemSchema.safeParse({ item: "Carrot", source: "meal", bought: false, reimbursed: false }).success).toBe(true);
  });

  it("uses safe notification defaults and has no safety-alert opt-out", () => {
    const parsed = notificationPrefsSchema.parse({});
    expect(parsed.messages).toBe(true);
    expect(parsed.mode).toBe("all");
    expect(parsed.allergyChanges).toBe(true);
    expect(notificationPrefsSchema.safeParse({ safetyAlerts: false }).success).toBe(false);
  });
});
