import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@cc/core";
import { attachAskToItem, answerAskOnItem, type TimelineAsk, type TimelineItem } from "../lib/timeline";
import { isConnectivityError, readSnapshot, saveSnapshot, writeSpaceDocument } from "./offline";

export type TodayRead = { items: TimelineItem[]; fromCache: boolean };
export type TodayWrite = { item: TimelineItem; queued: boolean };
const todaySnapshotKey = (spaceId: string, day: string) => `today:${spaceId}:${day}`;
const photoSnapshotKey = (spaceId: string) => `care-photos:${spaceId}`;
const makeId = () => globalThis.crypto?.randomUUID?.().replaceAll("-", "") ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export async function readToday(spaceId: string, day: string): Promise<TodayRead> {
  const key = todaySnapshotKey(spaceId, day);
  const cached = readSnapshot<TimelineItem[]>(key);
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { items: cached?.data ?? [], fromCache: cached !== null };
  }
  try {
    const result = await getDocs(query(collection(db, "careSpaces", spaceId, "dayStory"), where("day", "==", day)));
    const items = result.docs.map((snapshot) => ({ ...snapshot.data(), id: snapshot.id } as TimelineItem));
    saveSnapshot(key, items);
    return { items, fromCache: false };
  } catch (error) {
    if (!isConnectivityError(error)) throw error;
    return { items: cached?.data ?? [], fromCache: cached !== null };
  }
}

function normalizedPhotoTime(value: unknown): string | number {
  if (typeof value === "string" || typeof value === "number") return value;
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    try { return value.toDate().toISOString(); } catch { return ""; }
  }
  return "";
}

export function normalizeCareSpacePhotos(items: readonly TimelineItem[]): TimelineItem[] {
  return items.filter((item) => item.kind === "photo" && typeof item.photoKey === "string" && item.photoKey.length > 0)
    .sort((left, right) => {
      const leftTime = typeof left.at === "number" ? left.at : Date.parse(left.at);
      const rightTime = typeof right.at === "number" ? right.at : Date.parse(right.at);
      return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
    });
}

export async function readSpacePhotos(spaceId: string): Promise<TodayRead> {
  const key = photoSnapshotKey(spaceId);
  const cached = readSnapshot<TimelineItem[]>(key);
  if (typeof navigator !== "undefined" && !navigator.onLine) return { items: cached?.data ?? [], fromCache: cached !== null };
  try {
    const result = await getDocs(query(collection(db, "careSpaces", spaceId, "dayStory"), where("kind", "==", "photo")));
    const items = normalizeCareSpacePhotos(result.docs.map((snapshot) => {
      const data = snapshot.data();
      return {
        id: snapshot.id,
        day: typeof data.day === "string" ? data.day : "",
        kind: "photo",
        at: normalizedPhotoTime(data.at),
        text: typeof data.text === "string" ? data.text : "",
        ...(typeof data.childId === "string" ? { childId: data.childId } : {}),
        ...(typeof data.by === "string" ? { by: data.by } : {}),
        photoKey: typeof data.photoKey === "string" ? data.photoKey : "",
      } as TimelineItem;
    }));
    saveSnapshot(key, items);
    return { items, fromCache: false };
  } catch (error) {
    if (!isConnectivityError(error)) throw error;
    return { items: cached?.data ?? [], fromCache: cached !== null };
  }
}

export async function saveTodayItem(spaceId: string, item: TimelineItem): Promise<{ queued: boolean }> {
  const { id, ...data } = item;
  const result = await writeSpaceDocument({ path: `careSpaces/${spaceId}/dayStory/${id}`, method: "set", data });
  const cached = readSnapshot<TimelineItem[]>(todaySnapshotKey(spaceId, item.day));
  saveSnapshot(todaySnapshotKey(spaceId, item.day), [...(cached?.data ?? []).filter((entry) => entry.id !== id), item]);
  if (item.kind === "photo" && item.photoKey) {
    const photos = readSnapshot<TimelineItem[]>(photoSnapshotKey(spaceId));
    saveSnapshot(photoSnapshotKey(spaceId), normalizeCareSpacePhotos([...(photos?.data ?? []).filter((entry) => entry.id !== id), item]));
  }
  return result;
}

export type NewTimelineItem = {
  id?: string;
  day: string;
  kind: TimelineItem["kind"];
  at: string | number;
  text: string;
  childId?: string;
  by?: string;
  photoKey?: string;
  mood?: string;
  asks?: TimelineItem["asks"];
};

export async function addTodayItem(
  spaceId: string,
  item: NewTimelineItem,
): Promise<TodayWrite> {
  const id = item.id ?? makeId();
  const next: TimelineItem = { ...item, id };
  const result = await saveTodayItem(spaceId, next);
  return { item: next, queued: result.queued };
}

export async function askForTodayUpdate(
  spaceId: string,
  item: TimelineItem,
  ask: TimelineAsk,
): Promise<TodayWrite> {
  const next = attachAskToItem(item, ask);
  const result = await saveTodayItem(spaceId, next);
  return { item: next, queued: result.queued };
}

export async function answerTodayAsk(
  spaceId: string,
  item: TimelineItem,
  askIndex: number,
  response: { answeredAt: string; answerText?: string; answerPhotoKey?: string },
): Promise<TodayWrite> {
  const next = answerAskOnItem(item, askIndex, response);
  const result = await saveTodayItem(spaceId, next);
  return { item: next, queued: result.queued };
}

export function makeTodayAsk(uid: string, text: string): TimelineAsk {
  return { by: uid, text: text.trim(), at: new Date().toISOString() };
}
