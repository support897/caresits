import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@cc/core";
import { attachAskToItem, answerAskOnItem, type TimelineAsk, type TimelineItem } from "../lib/timeline";
import { isConnectivityError, readSnapshot, saveSnapshot, writeSpaceDocument } from "./offline";

export type TodayRead = { items: TimelineItem[]; fromCache: boolean };
const todaySnapshotKey = (spaceId: string, day: string) => `today:${spaceId}:${day}`;
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

export async function saveTodayItem(spaceId: string, item: TimelineItem): Promise<{ queued: boolean }> {
  const { id, ...data } = item;
  const cached = readSnapshot<TimelineItem[]>(todaySnapshotKey(spaceId, item.day));
  saveSnapshot(todaySnapshotKey(spaceId, item.day), [...(cached?.data ?? []).filter((entry) => entry.id !== id), item]);
  return writeSpaceDocument({ path: `careSpaces/${spaceId}/dayStory/${id}`, method: "set", data });
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
): Promise<TimelineItem> {
  const id = item.id ?? makeId();
  const next: TimelineItem = { ...item, id };
  await saveTodayItem(spaceId, next);
  return next;
}

export async function askForTodayUpdate(
  spaceId: string,
  item: TimelineItem,
  ask: TimelineAsk,
): Promise<TimelineItem> {
  const next = attachAskToItem(item, ask);
  await saveTodayItem(spaceId, next);
  return next;
}

export async function answerTodayAsk(
  spaceId: string,
  item: TimelineItem,
  askIndex: number,
  response: { answeredAt: string; answerText?: string; answerPhotoKey?: string },
): Promise<TimelineItem> {
  const next = answerAskOnItem(item, askIndex, response);
  await saveTodayItem(spaceId, next);
  return next;
}

export function makeTodayAsk(uid: string, text: string): TimelineAsk {
  return { by: uid, text: text.trim(), at: new Date().toISOString() };
}
