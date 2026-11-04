import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { notificationPrefsSchema, type NotificationPrefs } from "../../packages/core/src/schemas/index.js";
import { adminDb, adminMessaging } from "./admin.js";
import { enforceRateLimit } from "./rateLimit.js";

export type PushCategory = "message" | "booking" | "calendar" | "careUpdate" | "request" | "shopping" | "safety" | "allergy";

export interface PushEvent {
  recipientUid: string;
  category: PushCategory;
  actorUid?: string;
  isWorking?: boolean;
}

export interface PushCopy {
  title: string;
  body: string;
}

export interface PushDevice {
  token: string;
  active: boolean;
  platform?: string;
  kinds?: { message?: boolean; reminder?: boolean };
}

export interface PushStore {
  getPrefs(uid: string): Promise<unknown>;
  getDevices(uid: string): Promise<PushDevice[]>;
  send(tokens: string[], copy: PushCopy, category: PushCategory): Promise<void>;
}

const defaultPrefs = (): NotificationPrefs => notificationPrefsSchema.parse({});

export function shouldDeliverNotification(
  category: PushCategory,
  preferences: NotificationPrefs,
  isWorking = false,
): boolean {
  if (category === "safety" || category === "allergy") return true;
  if (isWorking && preferences.muteNonUrgentWhileWorking) return false;
  if (preferences.mode === "daily") return false;
  if (preferences.mode === "key" && !["booking", "request"].includes(category)) return false;
  switch (category) {
    case "message": return preferences.messages;
    case "booking": return preferences.bookings;
    case "calendar": return preferences.calendar;
    case "careUpdate": return preferences.careUpdates;
    case "request": return preferences.requests;
    case "shopping": return preferences.shopping;
  }
}

export function pushCopy(category: PushCategory): PushCopy {
  switch (category) {
    case "message": return { title: "New message", body: "You have a new care message." };
    case "booking": return { title: "Booking update", body: "Your booking details changed." };
    case "calendar": return { title: "Calendar update", body: "There is a new care schedule update." };
    case "careUpdate": return { title: "Care update", body: "There is a new update in your Care Space." };
    case "request": return { title: "New request", body: "There is a new care request." };
    case "shopping": return { title: "Shopping update", body: "The care list has changed." };
    case "allergy": return { title: "Allergy update", body: "A child’s allergy information changed." };
    case "safety": return { title: "Care safety update", body: "A care safety record changed." };
  }
}

export async function pushOnEvent(event: PushEvent, store: PushStore): Promise<number> {
  if (event.actorUid === event.recipientUid && event.category !== "safety" && event.category !== "allergy") return 0;
  const parsed = notificationPrefsSchema.safeParse(await store.getPrefs(event.recipientUid));
  const preferences = parsed.success ? parsed.data : defaultPrefs();
  if (!shouldDeliverNotification(event.category, preferences, event.isWorking)) return 0;
  const categoryKind = event.category === "message" ? "message" : "reminder";
  const devices = await store.getDevices(event.recipientUid);
  const tokens = devices
    .filter((device) => device.active && device.token.length > 0)
    .filter((device) => event.category === "safety" || event.category === "allergy" || device.kinds?.[categoryKind] !== false)
    .map((device) => device.token);
  if (tokens.length === 0) return 0;
  await store.send(tokens, pushCopy(event.category), event.category);
  return tokens.length;
}

async function dispatchToUsers(event: Omit<PushEvent, "recipientUid">, recipients: string[]): Promise<void> {
  const db = adminDb();
  const store: PushStore = {
    getPrefs: async (uid) => {
      const snapshot = await db.doc(`users/${uid}/prefs/main`).get();
      return snapshot.exists ? snapshot.data() : {};
    },
    getDevices: async (uid) => {
      const snapshot = await db.collection(`profiles/${uid}/devices`).where("active", "==", true).get();
      return snapshot.docs.flatMap((device) => {
        const data = device.data();
        return typeof data.token === "string" && data.token.length > 0
          ? [{ token: data.token, active: data.active === true, platform: data.platform, kinds: data.kinds }]
          : [];
      });
    },
    send: async (tokens, copy, category) => {
      await adminMessaging().sendEachForMulticast({
        tokens,
        notification: copy,
        data: { category },
        android: { priority: "normal" },
        apns: { headers: { "apns-priority": "5" } },
      });
    },
  };
  await Promise.all(recipients.map(async (recipientUid) => {
    if (event.category !== "safety" && event.category !== "allergy") {
      await enforceRateLimit(recipientUid, "push", 60, 60_000);
    }
    await pushOnEvent({ ...event, recipientUid }, store);
  }));
}

export const pushOnMessageCreated = onDocumentCreated("relationships/{pairId}/messages/{messageId}", async (event) => {
  const message = event.data?.data();
  if (!message || typeof message.from !== "string") return;
  const relationship = await adminDb().doc(`relationships/${event.params.pairId}`).get();
  const members = relationship.get("members");
  if (!Array.isArray(members)) return;
  await dispatchToUsers({ category: "message", actorUid: message.from }, members.filter((uid): uid is string => typeof uid === "string"));
});

export const pushOnBookingUpdated = onDocumentUpdated("relationships/{pairId}/bookings/{bookingId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after || before.state === after.state) return;
  const recipients = [after.familyUid, after.carerUid].filter((uid): uid is string => typeof uid === "string");
  await dispatchToUsers({ category: "booking" }, recipients);
});

export const pushOnCalendarCreated = onDocumentCreated("careSpaces/{spaceId}/calendar/{eventId}", async (event) => {
  const calendar = event.data?.data();
  if (!calendar) return;
  const members = await adminDb().collection(`careSpaces/${event.params.spaceId}/members`).where("status", "==", "active").get();
  const recipients = members.docs
    .filter((member) => member.id !== calendar.ownerUid)
    .filter((member) => member.get("role") === "admin" || member.get("perms.calendar") === true)
    .map((member) => member.id);
  await dispatchToUsers({
    category: "calendar",
    ...(typeof calendar.ownerUid === "string" ? { actorUid: calendar.ownerUid } : {}),
  }, recipients);
});

export const pushOnAlertCreated = onDocumentCreated("careSpaces/{spaceId}/alerts/{alertId}", async (event) => {
  const alert = event.data?.data();
  if (!alert) return;
  const category: PushCategory = alert.section === "allergies" ? "allergy" : "safety";
  const members = await adminDb().collection(`careSpaces/${event.params.spaceId}/members`).where("status", "==", "active").get();
  const recipients = members.docs.map((member) => member.id);
  await dispatchToUsers({
    category,
    ...(typeof alert.by === "string" ? { actorUid: alert.by } : {}),
  }, recipients);
});
