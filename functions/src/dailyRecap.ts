import { FieldValue } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { notificationPrefsSchema, type NotificationPrefs } from "../../packages/core/src/schemas/index.js";
import { adminDb, adminMessaging } from "./admin.js";

const RECAP_TIME_ZONE = "Australia/Brisbane";
const RECAP_WINDOW_MINUTES = 5;

interface LocalClock {
  date: string;
  minuteOfDay: number;
}

export function localClock(now: Date, timeZone = RECAP_TIME_ZONE): LocalClock {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((item) => item.type === type)?.value ?? "0";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    minuteOfDay: Number(part("hour")) * 60 + Number(part("minute")),
  };
}

export function shouldSendDailyRecap(
  preferences: NotificationPrefs,
  now: Date,
  lastSentDate?: string,
  timeZone = RECAP_TIME_ZONE,
): { send: boolean; date: string } {
  const clock = localClock(now, timeZone);
  const [hourText = "17", minuteText = "00"] = preferences.dailyRecapTime?.split(":") ?? [];
  const targetMinute = Number(hourText) * 60 + Number(minuteText);
  const elapsed = (clock.minuteOfDay - targetMinute + 1_440) % 1_440;
  return {
    date: clock.date,
    send: preferences.mode === "daily"
      && preferences.careUpdates
      && lastSentDate !== clock.date
      && elapsed < RECAP_WINDOW_MINUTES,
  };
}

export function dailyRecapCopy(updateCount: number): { title: string; body: string } {
  if (updateCount <= 0) return { title: "Your daily care recap", body: "No new care updates today." };
  if (updateCount === 1) return { title: "Your daily care recap", body: "You have 1 care update today." };
  return { title: "Your daily care recap", body: `You have ${updateCount} care updates today.` };
}

async function countCareUpdates(uid: string, day: string): Promise<number> {
  const db = adminDb();
  const spaces = await db.collection("careSpaces").get();
  let count = 0;
  for (const space of spaces.docs) {
    const member = await space.ref.collection("members").doc(uid).get();
    if (!member.exists || member.get("status") !== "active") continue;
    const rows = await space.ref.collection("dayStory").where("day", "==", day).get();
    const hasPhotoPermission = member.get("role") === "admin" || member.get("perms.photos") === true;
    count += rows.docs.filter((row) => {
      const data = row.data();
      return hasPhotoPermission || (data.kind !== "photo" && !("photoKey" in data));
    }).length;
  }
  return count;
}

async function sendRecap(uid: string, preferences: NotificationPrefs, date: string, updateCount: number): Promise<boolean> {
  const db = adminDb();
  const devicesSnapshot = await db.collection(`profiles/${uid}/devices`).where("active", "==", true).get();
  const tokens = devicesSnapshot.docs.flatMap((device) => {
    const data = device.data();
    return typeof data.token === "string" && data.token.length > 0 && data.kinds?.reminder !== false
      ? [data.token]
      : [];
  });
  if (tokens.length === 0 || !preferences.careUpdates) return false;

  const runRef = db.doc(`_dailyRecapRuns/${uid}_${date}`);
  const claimed = await db.runTransaction(async (transaction) => {
    const previous = await transaction.get(runRef);
    if (previous.exists) return false;
    transaction.create(runRef, { uid, date, claimedAt: FieldValue.serverTimestamp() });
    return true;
  });
  if (!claimed) return false;

  try {
    await adminMessaging().sendEachForMulticast({
      tokens,
      notification: dailyRecapCopy(updateCount),
      data: { category: "dailyRecap" },
      android: { priority: "normal" },
      apns: { headers: { "apns-priority": "5" } },
    });
    await runRef.update({ sentAt: FieldValue.serverTimestamp() });
    return true;
  } catch (error) {
    await runRef.delete();
    throw error;
  }
}

export const pushOnDailyRecap = onSchedule({
  schedule: "every 5 minutes",
  timeZone: RECAP_TIME_ZONE,
}, async () => {
  const db = adminDb();
  const now = new Date();
  const clock = localClock(now);
  const preferencesSnapshot = await db.collectionGroup("prefs").where("mode", "==", "daily").get();
  for (const preferenceDoc of preferencesSnapshot.docs) {
    const userDoc = preferenceDoc.ref.parent.parent;
    if (!userDoc || preferenceDoc.id !== "main") continue;
    const parsed = notificationPrefsSchema.safeParse(preferenceDoc.data());
    if (!parsed.success) continue;
    const preferences = parsed.data;
    const uid = userDoc.id;
    const previousRun = await db.doc(`_dailyRecapRuns/${uid}_${clock.date}`).get();
    const due = shouldSendDailyRecap(preferences, now, previousRun.exists ? clock.date : undefined);
    if (!due.send) continue;
    const updateCount = await countCareUpdates(uid, due.date);
    await sendRecap(uid, preferences, due.date, updateCount);
  }
});
