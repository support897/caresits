import { collection, doc, getDocs, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@cc/core";
import {
  careSpaceRequestRecordSchema,
  type CareSpaceRequestRecord,
} from "@cc/core/src/schemas/space-extras";
import type { SpaceRole } from "../lib/permissions";
import { isConnectivityError, isOnline, readSnapshot, saveSnapshot } from "./offline";
import type { SpaceSummary } from "./spaces";

export type SpaceRequest = CareSpaceRequestRecord & {
  id: string;
  spaceId: string;
  spaceName?: string;
  queued?: boolean;
};

export type NewSpaceRequest = {
  kind: CareSpaceRequestRecord["kind"];
  by: string;
  to?: string;
  text: string;
};

export type RequestDecision = Extract<CareSpaceRequestRecord["state"], "done" | "declined">;

const createRequestSchema = careSpaceRequestRecordSchema.omit({ at: true });
const REQUEST_QUEUE_KEY = "caresits-cs-request-writes-v1";
const requestSnapshotKey = (spaceId: string) => `requests:${spaceId}`;

type PendingRequestWrite =
  | { action: "create"; id: string; spaceId: string; data: Omit<CareSpaceRequestRecord, "at">; localAt: string; spaceName?: string }
  | { action: "decision"; id: string; spaceId: string; state: RequestDecision; request: SpaceRequest };

function queueStorage(): Pick<Storage, "getItem" | "setItem"> | undefined {
  try { return typeof localStorage === "undefined" ? undefined : localStorage; }
  catch { return undefined; }
}

function readPendingWrites(storage = queueStorage()): PendingRequestWrite[] {
  if (!storage) return [];
  try {
    const value: unknown = JSON.parse(storage.getItem(REQUEST_QUEUE_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((row): row is PendingRequestWrite => Boolean(
      row && typeof row === "object" && typeof row.id === "string" && typeof row.spaceId === "string"
      && (row.action === "create" || row.action === "decision"),
    ));
  } catch { return []; }
}

function savePendingWrites(rows: readonly PendingRequestWrite[]): void {
  const storage = queueStorage();
  if (!storage) throw new Error("request-offline-storage-unavailable");
  try { storage.setItem(REQUEST_QUEUE_KEY, JSON.stringify(rows)); }
  catch { throw new Error("request-offline-storage-unavailable"); }
}

function queuePendingWrite(write: PendingRequestWrite): void {
  const rows = readPendingWrites();
  savePendingWrites([...rows.filter((row) => !(row.id === write.id && row.spaceId === write.spaceId && row.action === write.action)), write]);
}

function saveCachedRequest(request: SpaceRequest): void {
  const cached = readSnapshot<SpaceRequest[]>(requestSnapshotKey(request.spaceId));
  saveSnapshot(requestSnapshotKey(request.spaceId), [
    request,
    ...(cached?.data ?? []).filter((row) => row.id !== request.id),
  ]);
}

function mergePendingRequests(rows: readonly SpaceRequest[], spaces: readonly SpaceSummary[]): SpaceRequest[] {
  const byKey = new Map(rows.map((request) => [`${request.spaceId}/${request.id}`, request]));
  for (const write of readPendingWrites()) {
    const space = spaces.find((entry) => entry.id === write.spaceId);
    if (!space) continue;
    const key = `${write.spaceId}/${write.id}`;
    if (write.action === "create") {
      byKey.set(key, {
        ...write.data,
        at: new Date(write.localAt),
        id: write.id,
        spaceId: write.spaceId,
        spaceName: write.spaceName ?? space.name,
        queued: true,
      });
    } else {
      const request = byKey.get(key) ?? write.request;
      byKey.set(key, { ...request, state: write.state, spaceName: space.name, queued: true });
    }
  }
  return [...byKey.values()].sort((left, right) => requestTime(right.at) - requestTime(left.at));
}

export function normalizeNewSpaceRequest(input: NewSpaceRequest): Omit<CareSpaceRequestRecord, "at"> {
  if (!input.text.trim()) throw new Error("request-text-required");
  const parsed = createRequestSchema.safeParse({
    kind: input.kind,
    by: input.by,
    ...(input.to?.trim() ? { to: input.to.trim() } : {}),
    text: input.text.trim(),
    state: "open",
  });
  if (!parsed.success) throw new Error("invalid-request");
  return parsed.data;
}

export function transitionSpaceRequest(
  request: CareSpaceRequestRecord,
  nextState: RequestDecision,
  actorUid: string,
  role: SpaceRole,
): CareSpaceRequestRecord {
  if (request.state !== "open") throw new Error("request-no-longer-open");
  if (!actorUid || (role !== "admin" && request.to !== actorUid)) throw new Error("request-decision-not-allowed");
  return { ...request, state: nextState };
}

function makeId(): string {
  return globalThis.crypto?.randomUUID?.().replaceAll("-", "")
    ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function dispatchRequestChange(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("carespace:requests-changed"));
}

export async function readRequestsForSpaces(spaces: readonly SpaceSummary[]): Promise<SpaceRequest[]> {
  const rows = await Promise.all(spaces.map(async (space) => {
    const cached = readSnapshot<SpaceRequest[]>(requestSnapshotKey(space.id));
    if (!isOnline()) return cached?.data ?? [];
    try {
      const result = await getDocs(collection(db, "careSpaces", space.id, "requests"));
      const requests = result.docs.flatMap((snapshot): SpaceRequest[] => {
        const parsed = careSpaceRequestRecordSchema.safeParse(snapshot.data());
        return parsed.success
          ? [{ ...parsed.data, id: snapshot.id, spaceId: space.id, spaceName: space.name }]
          : [];
      });
      saveSnapshot(requestSnapshotKey(space.id), requests);
      return requests;
    } catch (error) {
      if (isConnectivityError(error)) return cached?.data ?? [];
      throw error;
    }
  }));
  return mergePendingRequests(rows.flat(), spaces);
}

function requestTime(value: CareSpaceRequestRecord["at"]): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") return Date.parse(value) || 0;
  if (typeof value === "number") return value;
  if (value && typeof value === "object") return value.seconds * 1_000 + Math.floor(value.nanoseconds / 1_000_000);
  return 0;
}

export async function createSpaceRequest(
  spaceId: string,
  input: NewSpaceRequest,
  spaceName?: string,
): Promise<SpaceRequest> {
  if (!spaceId || !input.by) throw new Error("request-space-required");
  const data = normalizeNewSpaceRequest(input);
  const id = makeId();
  const localAt = new Date();
  const request: SpaceRequest = { ...data, at: localAt, id, spaceId, ...(spaceName ? { spaceName } : {}) };
  if (!isOnline()) {
    queuePendingWrite({ action: "create", id, spaceId, data, localAt: localAt.toISOString(), ...(spaceName ? { spaceName } : {}) });
    saveCachedRequest({ ...request, queued: true });
    dispatchRequestChange();
    return { ...request, queued: true };
  }
  try {
    await setDoc(doc(db, "careSpaces", spaceId, "requests", id), { ...data, at: serverTimestamp() });
  } catch (error) {
    if (!isConnectivityError(error)) throw error;
    queuePendingWrite({ action: "create", id, spaceId, data, localAt: localAt.toISOString(), ...(spaceName ? { spaceName } : {}) });
    saveCachedRequest({ ...request, queued: true });
    dispatchRequestChange();
    return { ...request, queued: true };
  }
  saveCachedRequest(request);
  dispatchRequestChange();
  return request;
}

export async function decideSpaceRequest(
  request: SpaceRequest,
  nextState: RequestDecision,
  actorUid: string,
  role: SpaceRole,
): Promise<SpaceRequest> {
  const updated = transitionSpaceRequest(request, nextState, actorUid, role);
  const localUpdate = { ...request, state: updated.state };
  if (!isOnline()) {
    queuePendingWrite({ action: "decision", id: request.id, spaceId: request.spaceId, state: nextState, request });
    const queued = { ...localUpdate, queued: true };
    saveCachedRequest(queued);
    dispatchRequestChange();
    return queued;
  }
  try {
    await updateDoc(doc(db, "careSpaces", request.spaceId, "requests", request.id), { state: updated.state });
  } catch (error) {
    if (!isConnectivityError(error)) throw error;
    queuePendingWrite({ action: "decision", id: request.id, spaceId: request.spaceId, state: nextState, request });
    const queued = { ...localUpdate, queued: true };
    saveCachedRequest(queued);
    dispatchRequestChange();
    return queued;
  }
  saveCachedRequest(localUpdate);
  dispatchRequestChange();
  return localUpdate;
}

export async function flushPendingSpaceRequests(): Promise<number> {
  if (!isOnline()) return 0;
  let pending = readPendingWrites();
  let sent = 0;
  while (pending.length) {
    const write = pending[0]!;
    try {
      if (write.action === "create") {
        await setDoc(doc(db, "careSpaces", write.spaceId, "requests", write.id), { ...write.data, at: serverTimestamp() });
      } else {
        await updateDoc(doc(db, "careSpaces", write.spaceId, "requests", write.id), { state: write.state });
      }
    } catch { break; }
    pending = pending.slice(1);
    savePendingWrites(pending);
    sent += 1;
  }
  if (sent) dispatchRequestChange();
  return sent;
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => { void flushPendingSpaceRequests(); });
  if (isOnline()) void flushPendingSpaceRequests();
}
