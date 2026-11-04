import { addDoc, collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db, getPrivateMediaUrl, schemas, t, uploadMediaFile } from "@cc/core";
import type { CareRole } from "./children";

export type CareSpaceGalleryItem = {
  id: string;
  key: string;
  kind: "photo" | "video";
  by: string;
  at: Date;
  childId?: string;
  sharedByParent: boolean;
};

export type NewGalleryItem = Omit<CareSpaceGalleryItem, "id" | "at" | "sharedByParent"> & { sharedByParent?: boolean };

export function canShareGallery(role: CareRole): boolean {
  return role === "admin";
}

export function canViewGalleryItem(item: Pick<CareSpaceGalleryItem, "childId" | "sharedByParent">, role: CareRole): boolean {
  return role === "admin" || !item.childId || item.sharedByParent;
}

export function visibleGalleryItems(items: readonly CareSpaceGalleryItem[], role: CareRole): CareSpaceGalleryItem[] {
  return items.filter((item) => canViewGalleryItem(item, role));
}

export function isGalleryKeyForSpace(spaceId: string, key: string): boolean {
  return /^[A-Za-z0-9_-]{1,128}$/.test(spaceId) && key.startsWith(`spaces/${spaceId}/`)
    && /^spaces\/[A-Za-z0-9_-]{1,128}\/.+/.test(key) && !key.includes("..");
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (value && typeof value === "object") {
    const timestamp = value as { toDate?: () => Date; seconds?: number };
    if (typeof timestamp.toDate === "function") {
      try { const date = timestamp.toDate(); return Number.isFinite(date.getTime()) ? date : null; } catch { return null; }
    }
    if (typeof timestamp.seconds === "number") {
      const date = new Date(timestamp.seconds * 1_000);
      return Number.isFinite(date.getTime()) ? date : null;
    }
  }
  return null;
}

function fromDocument(id: string, value: Record<string, unknown>): CareSpaceGalleryItem | null {
  const at = toDate(value.at);
  if (!at) return null;
  const parsed = schemas.spaceGalleryRecordSchema.safeParse({ ...value, at });
  if (!parsed.success) return null;
  return { id, ...parsed.data, at };
}

export async function loadGallery(spaceId: string, role: CareRole): Promise<CareSpaceGalleryItem[]> {
  const reference = collection(db, "careSpaces", spaceId, "gallery");
  // The query excludes private child records so Firestore rules can authorize it without treating rules as filters.
  const result = role === "admin"
    ? await getDocs(reference)
    : await getDocs(query(reference, where("sharedByParent", "==", true)));
  const items = result.docs.flatMap((snapshot) => {
    const item = fromDocument(snapshot.id, snapshot.data());
    return item ? [item] : [];
  });
  return visibleGalleryItems(items, role).sort((left, right) => right.at.getTime() - left.at.getTime());
}

export async function addGalleryItem(spaceId: string, item: NewGalleryItem): Promise<CareSpaceGalleryItem> {
  if (!isGalleryKeyForSpace(spaceId, item.key)) throw new Error(t("care.galleryBadKey", "This file does not belong to this care space."));
  const now = new Date();
  const record = {
    key: item.key,
    kind: item.kind,
    by: item.by,
    at: now,
    ...(item.childId ? { childId: item.childId } : {}),
    sharedByParent: item.childId ? false : item.sharedByParent ?? true,
  };
  const parsed = schemas.spaceGalleryRecordSchema.safeParse(record);
  if (!parsed.success) throw new Error(t("care.galleryInvalid", "This photo or video could not be added."));
  const reference = await addDoc(collection(db, "careSpaces", spaceId, "gallery"), { ...parsed.data, at: serverTimestamp() });
  return { id: reference.id, ...parsed.data, at: now };
}

export async function setGalleryItemShared(spaceId: string, itemId: string, sharedByParent: boolean, role: CareRole): Promise<void> {
  if (!canShareGallery(role)) throw new Error(t("care.galleryShareAdminOnly", "Only a parent can change photo sharing."));
  await updateDoc(doc(db, "careSpaces", spaceId, "gallery", itemId), { sharedByParent });
}

export async function uploadGalleryPhoto(spaceId: string, uid: string, file: File, childId?: string): Promise<CareSpaceGalleryItem> {
  const key = await uploadMediaFile({ uid, spaceId, file, kind: "gallery" });
  return addGalleryItem(spaceId, { key, kind: "photo", by: uid, ...(childId ? { childId } : {}) });
}

export { getPrivateMediaUrl };
