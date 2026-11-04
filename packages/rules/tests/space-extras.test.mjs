import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { createRequire } from "node:module";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import ts from "typescript";

const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const schemaRequire = createRequire(new URL("../../core/package.json", import.meta.url));
const schemaSource = readFileSync(new URL("../../core/src/schemas/space-extras.ts", import.meta.url), "utf8");
const schemaModule = { exports: {} };
const compiledSchema = ts.transpileModule(schemaSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
new Function("require", "exports", compiledSchema)(schemaRequire, schemaModule.exports);
const {
  careSpaceChildRecordSchema,
  careSpaceCalendarEventSchema,
  careSpaceRequestRecordSchema,
  careSpacePlanRecordSchema,
  careSpaceApprovalRecordSchema,
  spaceGalleryRecordSchema,
} = schemaModule.exports;

test("CareSpace Zod records enforce structured payloads", () => {
  const at = new Date("2026-11-04T00:00:00.000Z");
  assert.equal(careSpaceChildRecordSchema.safeParse({
    name: "Mia", foodPreferences: ["vegetarian"], learningGoals: ["counting"],
    milestones: [{ title: "First bike ride", at, note: "With help", photoKey: "spaces/family-space/milestone.webp" }],
    routine: { wake: "07:00", bed: "19:30", naps: [{ from: "12:30", to: "13:30" }] },
  }).success, true);
  assert.equal(careSpaceChildRecordSchema.safeParse({ name: "Mia", allergies: ["peanut"] }).success, false);
  assert.equal(careSpaceChildRecordSchema.safeParse({ name: "Mia", milestones: [{ title: "First", at, extra: true }] }).success, false);
  assert.equal(careSpaceCalendarEventSchema.safeParse({
    kind: "shift", title: "Morning care", start: at, end: at, ownerUid: "carer", state: "active",
    recurring: { weekdays: ["Mon", "Fri"], until: "2026-12-31" },
  }).success, true);
  assert.equal(careSpaceCalendarEventSchema.safeParse({
    kind: "shift", title: "Morning care", start: at, end: at, ownerUid: "carer", state: "active",
    recurring: { weekdays: ["Mon"], until: "2026-12-31", monthly: true },
  }).success, false);
  assert.equal(careSpaceRequestRecordSchema.safeParse({ kind: "photo", by: "carer", text: "x".repeat(300), state: "open", at }).success, true);
  assert.equal(careSpaceRequestRecordSchema.safeParse({ kind: "photo", by: "carer", text: "x".repeat(301), state: "open", at }).success, false);
  assert.equal(careSpacePlanRecordSchema.safeParse({ days: { Mon: ["activity-1"] } }).success, true);
  assert.equal(careSpacePlanRecordSchema.safeParse({ days: { Monday: ["activity-1"] } }).success, false);
  assert.equal(careSpaceApprovalRecordSchema.safeParse({ kind: "meal", ref: "meal-1", state: "pending", by: "carer" }).success, true);
  assert.equal(spaceGalleryRecordSchema.safeParse({ key: "spaces/family-space/gallery/photo.webp", kind: "photo", by: "carer", at, sharedByParent: false }).success, true);
  assert.equal(spaceGalleryRecordSchema.safeParse({ key: "https://example.invalid/photo.webp", kind: "photo", by: "carer", at, sharedByParent: false }).success, false);
});
const spaceId = "family-space";
const childPath = `careSpaces/${spaceId}/children`;
const calendarPath = `careSpaces/${spaceId}/calendar`;
const requestPath = `careSpaces/${spaceId}/requests`;
const planPath = `careSpaces/${spaceId}/plans`;
const approvalPath = `careSpaces/${spaceId}/approvals`;
const galleryPath = `careSpaces/${spaceId}/gallery`;
const memberPerms = (overrides = {}) => ({
  allergies: false,
  medication: false,
  photos: false,
  calendar: false,
  privateMessages: false,
  canInvite: false,
  canEditAllergies: false,
  ...overrides,
});
test("CareSpace structured records enforce membership and parent controls", { concurrency: 1 }, async (t) => {
  const env = await initializeTestEnvironment({
    projectId: "demo-cc-space-extras",
    firestore: { rules, host: "127.0.0.1", port: 8085 },
  });
  const as = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: "password" } }).firestore();
  const parent = as("parent");
  const carer = as("carer");
  const limited = as("limited");
  const gran = as("gran");
  const outsider = as("outsider");

  try {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, `careSpaces/${spaceId}`), { ownerUid: "parent", name: "Family", createdAt: new Date() });
      await setDoc(doc(db, `careSpaces/${spaceId}/members/parent`), { role: "admin", status: "active" });
      await setDoc(doc(db, `careSpaces/${spaceId}/members/carer`), { role: "regular", status: "active", perms: memberPerms({ calendar: true, privateMessages: true }) });
      await setDoc(doc(db, `careSpaces/${spaceId}/members/limited`), { role: "limited", status: "active", perms: memberPerms({ calendar: true }) });
      await setDoc(doc(db, `careSpaces/${spaceId}/members/gran`), { role: "viewer", status: "active", perms: memberPerms({ photos: true, calendar: true }) });
      await setDoc(doc(db, `careSpaces/${spaceId}/members/allergy-editor`), { role: "regular", status: "active", perms: memberPerms({ canEditAllergies: true }) });
      await setDoc(doc(db, `careSpaces/${spaceId}/medical/c1/allergies/main`), { items: [{ name: "peanut" }], updatedBy: "parent", updatedAt: new Date(), alertId: "seed" });
    });

    await t.test("admin saves structured child preferences, milestones, and routine", async () => {
      await assertSucceeds(setDoc(doc(parent, `${childPath}/c1`), {
        name: "Mia",
        ageYears: 4,
        foodPreferences: ["vegetarian", "likes berries"],
        learningGoals: ["practice counting"],
        milestones: [{ title: "First bike ride", at: new Date("2026-11-04T00:00:00Z"), note: "With support", photoKey: `spaces/${spaceId}/milestones/bike.webp` }],
        routine: { wake: "07:00", bed: "19:30", naps: [{ from: "12:30", to: "13:30" }] },
        createdAt: serverTimestamp(),
      }));
    });
    await t.test("medical fields cannot be placed in a child profile", async () => {
      await assertFails(setDoc(doc(parent, `${childPath}/bad-medical`), { name: "Mia", allergies: ["peanut"] }));
    });
    await t.test("milestones must use a structured list field", async () => {
      await assertFails(setDoc(doc(parent, `${childPath}/bad-milestone`), { name: "Mia", milestones: { title: "First bike ride" } }));
    });
    await t.test("routine naps must use a structured list field", async () => {
      await assertFails(setDoc(doc(parent, `${childPath}/bad-nap`), { name: "Mia", routine: { naps: "12:30" } }));
    });
    await t.test("food preferences must use the structured list field", async () => {
      await assertFails(setDoc(doc(parent, `${childPath}/bad-food`), { name: "Mia", foodPreferences: "vegetarian" }));
    });
    await t.test("carers cannot change parent-owned structured fields", async () => {
      await assertFails(updateDoc(doc(carer, `${childPath}/c1`), { foodPreferences: ["new value"] }));
    });
    await t.test("carers cannot write medical records even with canEditAllergies", async () => {
      const editor = as("allergy-editor");
      await assertFails(setDoc(doc(editor, `careSpaces/${spaceId}/medical/c1/allergies/changed`), {
        items: [{ name: "egg" }], updatedBy: "allergy-editor", updatedAt: serverTimestamp(), alertId: "allergy-change",
      }));
    });

    await t.test("calendar accepts the modeled recurring fields", async () => {
      await assertSucceeds(setDoc(doc(carer, `${calendarPath}/weekly-shift`), {
        kind: "shift", title: "Morning care", start: new Date("2026-11-09T09:00:00Z"), end: new Date("2026-11-09T12:00:00Z"),
        ownerUid: "carer", state: "active", recurring: { weekdays: ["Mon", "Fri"], until: "2026-12-31" },
      }));
    });
    await t.test("calendar rejects unknown recurrence keys", async () => {
      await assertFails(setDoc(doc(carer, `${calendarPath}/bad-recurring-key`), {
        kind: "shift", title: "Morning care", start: new Date(), end: new Date(Date.now() + 3_600_000),
        ownerUid: "carer", state: "active", recurring: { weekdays: ["Mon"], until: "2026-12-31", monthly: true },
      }));
    });
    await t.test("calendar rejects unknown weekdays", async () => {
      await assertFails(setDoc(doc(carer, `${calendarPath}/bad-weekday`), {
        kind: "shift", title: "Morning care", start: new Date(), end: new Date(Date.now() + 3_600_000),
        ownerUid: "carer", state: "active", recurring: { weekdays: ["Funday"], until: "2026-12-31" },
      }));
    });

    await t.test("all active members can create requests as themselves", async () => {
      await assertSucceeds(setDoc(doc(gran, `${requestPath}/photo-request`), {
        kind: "photo", by: "gran", to: "parent", text: "Please share a photo.", state: "open", at: serverTimestamp(),
      }));
      await assertSucceeds(setDoc(doc(carer, `${requestPath}/meal-request`), {
        kind: "meal", by: "carer", text: "Please confirm lunch preference.", state: "open", at: serverTimestamp(),
      }));
    });
    await t.test("request creators cannot impersonate another member", async () => {
      await assertFails(setDoc(doc(carer, `${requestPath}/spoofed`), {
        kind: "photo", by: "parent", to: "parent", text: "Please share a photo.", state: "open", at: serverTimestamp(),
      }));
    });
    await t.test("request text is limited to 300 characters", async () => {
      await assertFails(setDoc(doc(carer, `${requestPath}/too-long`), {
        kind: "shopping", by: "carer", text: "x".repeat(301), state: "open", at: serverTimestamp(),
      }));
      await assertSucceeds(setDoc(doc(carer, `${requestPath}/max-length`), {
        kind: "shopping", by: "carer", text: "x".repeat(300), state: "open", at: serverTimestamp(),
      }));
    });
    await t.test("only the addressee or admin can decide a request", async () => {
      const request = doc(carer, `${requestPath}/assigned-to-parent`);
      await assertSucceeds(setDoc(request, { kind: "photo", by: "carer", to: "parent", text: "Send a photo.", state: "open", at: serverTimestamp() }));
      await assertFails(updateDoc(request, { state: "done" }));
      await assertFails(updateDoc(doc(limited, `${requestPath}/assigned-to-parent`), { state: "declined" }));
      await assertSucceeds(updateDoc(doc(parent, `${requestPath}/assigned-to-parent`), { state: "done" }));
    });
    await t.test("admin can decide a request addressed to another member", async () => {
      await assertSucceeds(setDoc(doc(carer, `${requestPath}/assigned-to-gran`), {
        kind: "swap", by: "carer", to: "gran", text: "Could we swap days?", state: "open", at: serverTimestamp(),
      }));
      await assertFails(updateDoc(doc(limited, `${requestPath}/assigned-to-gran`), { state: "done" }));
      await assertSucceeds(updateDoc(doc(parent, `${requestPath}/assigned-to-gran`), { state: "declined" }));
    });

    await t.test("members can write plan days but cannot approve plans", async () => {
      const plan = doc(carer, `${planPath}/week-2026-11-09`);
      await assertSucceeds(setDoc(plan, { days: { Mon: ["activity-1"], Wed: [] } }));
      await assertFails(updateDoc(plan, { approvedBy: "carer" }));
      await assertSucceeds(updateDoc(doc(parent, `${planPath}/week-2026-11-09`), { approvedBy: "parent" }));
      await assertSucceeds(updateDoc(plan, { days: { Tue: ["activity-2"] } }));
      await assertFails(updateDoc(plan, { approvedBy: "carer" }));
      await assertFails(setDoc(doc(outsider, `${planPath}/outsider-plan`), { days: { Mon: ["activity-3"] } }));
    });
    await t.test("only admin can set approvedBy to themselves", async () => {
      await assertFails(setDoc(doc(parent, `${planPath}/bad-approval`), { days: { Mon: [] }, approvedBy: "carer" }));
    });

    await t.test("approval creator must be self and start pending", async () => {
      await assertSucceeds(setDoc(doc(carer, `${approvalPath}/activity-approval`), {
        kind: "activity", ref: "activity-1", state: "pending", by: "carer",
      }));
      await assertFails(setDoc(doc(carer, `${approvalPath}/spoofed-approval`), {
        kind: "meal", ref: "meal-1", state: "pending", by: "parent",
      }));
      await assertFails(setDoc(doc(carer, `${approvalPath}/pre-decided`), {
        kind: "purchase", ref: "item-1", state: "approved", by: "carer", decidedBy: "carer",
      }));
    });
    await t.test("only admin can decide approvals", async () => {
      const approval = doc(carer, `${approvalPath}/activity-approval`);
      await assertFails(updateDoc(approval, { state: "approved", decidedBy: "carer" }));
      await assertFails(updateDoc(doc(limited, `${approvalPath}/activity-approval`), { state: "declined", decidedBy: "limited" }));
      await assertFails(updateDoc(doc(parent, `${approvalPath}/activity-approval`), { state: "approved", decidedBy: "carer" }));
      await assertSucceeds(updateDoc(doc(parent, `${approvalPath}/activity-approval`), { state: "approved", decidedBy: "parent" }));
    });

    await t.test("viewer defaults include calendar and photos but not allergy editing or invites", async () => {
      const inviteId = "viewer-defaults-invite";
      await assertSucceeds(setDoc(doc(parent, `careSpaceInvites/${inviteId}`), {
        spaceId, role: "viewer", createdBy: "parent", createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 60_000), usedBy: null,
      }));
      const newViewer = as("grandparent");
      const batch = writeBatch(newViewer);
      batch.update(doc(newViewer, `careSpaceInvites/${inviteId}`), { usedBy: "grandparent" });
      batch.set(doc(newViewer, `careSpaces/${spaceId}/members/grandparent`), {
        role: "viewer", status: "active", perms: memberPerms({ photos: true, calendar: true }),
        inviteId, invitedBy: "parent", joinedAt: serverTimestamp(),
      });
      await assertSucceeds(batch.commit());
      const memberSnap = await getDoc(doc(parent, `careSpaces/${spaceId}/members/grandparent`));
      assert.deepEqual(memberSnap.data().perms, memberPerms({ photos: true, calendar: true }));
      await assertSucceeds(getDoc(doc(newViewer, `${calendarPath}/weekly-shift`)));
      await assertFails(getDoc(doc(newViewer, `careSpaces/${spaceId}/medical/c1/allergies/main`)));
      await assertFails(setDoc(doc(newViewer, "careSpaceInvites/grandparent-invite"), {
        spaceId, role: "regular", createdBy: "grandparent", createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 60_000), usedBy: null,
      }));
    });

    await t.test("members can add non-child gallery items", async () => {
      await assertSucceeds(setDoc(doc(carer, `${galleryPath}/shared-nonchild`), {
        key: `spaces/${spaceId}/gallery/activity.webp`, kind: "photo", by: "carer", at: serverTimestamp(), sharedByParent: false,
      }));
      await assertSucceeds(getDoc(doc(gran, `${galleryPath}/shared-nonchild`)));
    });
    await t.test("child gallery photos stay private until admin shares them", async () => {
      const childPhoto = doc(carer, `${galleryPath}/child-photo`);
      await assertSucceeds(setDoc(childPhoto, {
        key: `spaces/${spaceId}/children/c1/photo.webp`, kind: "photo", by: "carer", at: serverTimestamp(),
        childId: "c1", sharedByParent: false,
      }));
      await assertSucceeds(getDoc(doc(parent, `${galleryPath}/child-photo`)));
      await assertFails(getDoc(doc(carer, `${galleryPath}/child-photo`)));
      await assertFails(getDoc(doc(gran, `${galleryPath}/child-photo`)));
      await assertFails(updateDoc(childPhoto, { sharedByParent: true }));
      await assertSucceeds(updateDoc(doc(parent, `${galleryPath}/child-photo`), { sharedByParent: true }));
      await assertSucceeds(getDoc(doc(carer, `${galleryPath}/child-photo`)));
      await assertSucceeds(getDoc(doc(gran, `${galleryPath}/child-photo`)));
    });
    await t.test("members cannot create already-shared child photos or forge uploaders", async () => {
      await assertFails(setDoc(doc(carer, `${galleryPath}/premature-share`), {
        key: `spaces/${spaceId}/children/c1/photo.webp`, kind: "photo", by: "carer", at: serverTimestamp(),
        childId: "c1", sharedByParent: true,
      }));
      await assertFails(setDoc(doc(carer, `${galleryPath}/spoofed-uploader`), {
        key: `spaces/${spaceId}/gallery/photo.webp`, kind: "photo", by: "parent", at: serverTimestamp(), sharedByParent: false,
      }));
    });
  } finally {
    await env.cleanup();
  }
});
