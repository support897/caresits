import { auth } from "../auth";
import { t } from "../i18n";
import { containsExifBytes, stripExif } from "./exif";
import { MEDIA_GATEKEEPER_BASE_URL, MAX_ATTACHMENT_BYTES, MAX_PHOTO_BYTES, MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS, PRESIGNED_LINK_SECONDS } from "./config";

export type MediaKind = "avatar" | "child" | "gallery" | "video" | "attachment";
export type UploadProgress = { stage: "prepare" | "link" | "upload" | "confirm" | "done"; percent: number };
export type MediaUploadOptions = { uid?: string; spaceId?: string; shareWithSpace?: boolean; file: File; kind: MediaKind; onProgress?: (progress: UploadProgress) => void };
export type DocumentUploadOptions = { uid?: string; file: File; onProgress?: (progress: UploadProgress) => void };

type GatekeeperLink = { url?: string; headers?: Record<string, string>; expiresIn?: number; key?: string; ok?: boolean };
const SAFE_SEGMENT = /^[A-Za-z0-9_-]{1,128}$/;
const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;
export function getVideoReasons(size: number, duration: number): string[] {
  const reasons: string[] = [];
  if (!Number.isFinite(size) || size <= 0) return [t("media.chooseVideo", "Choose a video first.")];
  if (size > MAX_VIDEO_BYTES) reasons.push(t("media.videoTooLarge", "Video must be 50 MB or smaller."));
  if (!Number.isFinite(duration) || duration <= 0) reasons.push(t("media.videoLengthUnknown", "The video length could not be checked."));
  else if (duration > MAX_VIDEO_SECONDS) reasons.push(t("media.videoTooLong", "Video must be 60 seconds or shorter."));
  return reasons;
}
const report = (callback: MediaUploadOptions["onProgress"], stage: UploadProgress["stage"], percent: number) => {
  try { callback?.({ stage, percent }); } catch { /* progress display cannot stop a transfer */ }
};
const makeId = () => globalThis.crypto?.randomUUID?.().replace(/-/g, "") ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;

export function mediaKeyFor({ uid, spaceId, shareWithSpace = false, kind, id, extension }: { uid: string; spaceId?: string; shareWithSpace?: boolean; kind: MediaKind | "document"; id: string; extension: string }): string | null {
  if (!SAFE_SEGMENT.test(uid) || !SAFE_ID.test(id)) return null;
  const ext = extension.toLowerCase().replace(/^\./, "");
  if (kind === "avatar" && ext === "jpg") return `users/${uid}/photos/avatar-${id}.jpg`;
  if (kind === "gallery" && ext === "jpg") {
    if (spaceId && !SAFE_SEGMENT.test(spaceId)) return null;
    return spaceId ? `spaces/${spaceId}/gallery/photo-${id}.jpg` : `users/${uid}/gallery/photo-${id}.jpg`;
  }
  if (kind === "child" && ext === "jpg") {
    if (shareWithSpace && spaceId && SAFE_SEGMENT.test(spaceId)) return `spaces/${spaceId}/children/child-${id}.jpg`;
    if (shareWithSpace) return null;
    return `users/${uid}/children/child-${id}.jpg`;
  }
  if (kind === "video" && ["mp4", "mov", "webm"].includes(ext)) return `users/${uid}/videos/intro-${id}.${ext}`;
  if (kind === "document" && ["pdf", "jpg"].includes(ext)) return `users/${uid}/documents/qual-${id}.${ext}`;
  if (kind === "attachment" && ["pdf", "jpg"].includes(ext)) return `users/${uid}/attachments/attachment-${id}.${ext}`;
  return null;
}

export function mediaAttachmentKind(key: string): "image" | "pdf" | null {
  if (typeof key !== "string" || key.includes("..")) return null;
  const segments = key.split("/");
  if (segments.length < 4 || !["users", "spaces"].includes(segments[0] ?? "")
    || !segments.every((segment) => /^[A-Za-z0-9_.-]{1,180}$/.test(segment))) return null;
  const extension = segments.at(-1)?.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "webp"].includes(extension ?? "")) return "image";
  if (extension === "pdf") return "pdf";
  return null;
}

function friendlyError(status: number, error?: string): string {
  if (status === 401) return t("media.signInAgain", "Your sign-in expired. Sign in again.");
  if (status === 403) return t("media.noAccess", "You do not have access to save this file.");
  if (status === 404) return t("media.serviceMissing", "The file service is not ready yet.");
  if (status === 409) return t("media.linkExpired", "Upload took too long. Choose the file again.");
  if (status === 413 || error === "bad size") return t("media.fileTooLarge", "This file is too large to save.");
  if (status === 429) return t("media.uploadLimit", "Please wait before uploading another file.");
  if (status >= 500) return t("media.serviceProblem", "The file service had a problem. Try again later.");
  return t("media.uploadFailed", "Could not upload this file. Try again.");
}

async function gatekeeperCall(route: string, body: Record<string, unknown>, token: string): Promise<GatekeeperLink> {
  let response: Response;
  try {
    response = await fetch(`${MEDIA_GATEKEEPER_BASE_URL.replace(/\/$/, "")}${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch { throw new Error(t("media.serviceOffline", "Could not reach the file service. Try again when you are online.")); }
  const result = await response.json().catch(() => null) as (GatekeeperLink & { error?: string }) | null;
  if (!response.ok || !result) throw new Error(friendlyError(response.status, result?.error));
  return result;
}

async function currentUser(uid?: string) {
  const user = auth().currentUser;
  if (!user) throw new Error(t("media.signInAgain", "Your sign-in expired. Sign in again."));
  if (uid && uid !== user.uid) throw new Error(t("media.noAccess", "You do not have access to save this file."));
  const token = await user.getIdToken().catch(() => "");
  if (!token) throw new Error(t("media.signInAgain", "Your sign-in expired. Sign in again."));
  return { user, token };
}

async function putFile(url: string, headers: Record<string, string>, file: Blob, callback?: MediaUploadOptions["onProgress"]): Promise<void> {
  if (typeof XMLHttpRequest !== "function") {
    const safeHeaders = Object.fromEntries(Object.entries(headers).filter(([name]) => name.toLowerCase() !== "content-length"));
    const response = await fetch(url, { method: "PUT", headers: safeHeaders, body: file });
    if (!response.ok) throw new Error(t("media.uploadFailed", "Could not upload this file. Try again."));
    report(callback, "upload", 95);
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url, true);
    Object.entries(headers).forEach(([name, value]) => { if (name.toLowerCase() !== "content-length") request.setRequestHeader(name, value); });
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) report(callback, "upload", Math.min(95, Math.round(event.loaded / event.total * 95)));
    };
    request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(t("media.uploadFailed", "Could not upload this file. Try again.")));
    request.onerror = () => reject(new Error(t("media.uploadFailed", "Could not upload this file. Try again.")));
    request.onabort = () => reject(new Error(t("media.uploadStopped", "Upload stopped. Choose the file again.")));
    request.send(file);
  });
}

async function uploadToGatekeeper({ token, uid, key, mediaClass, spaceId, file, onProgress }: { token: string; uid: string; key: string; mediaClass: "user-media" | "space-media" | "video-intros"; spaceId?: string; file: Blob; onProgress?: MediaUploadOptions["onProgress"] }): Promise<string> {
  const name = key.slice(key.lastIndexOf("/") + 1);
  const body = { class: mediaClass, name, ownerUid: uid, bytes: file.size, contentType: file.type || "application/octet-stream", ...(spaceId ? { spaceId } : {}) };
  report(onProgress, "link", 0);
  const link = await gatekeeperCall("/v1/link", { ...body, op: "put" }, token);
  if (!link.url || !link.headers || Number(link.expiresIn) !== PRESIGNED_LINK_SECONDS) throw new Error(t("media.badLink", "The file service did not give a safe five-minute upload link."));
  if (link.key && link.key !== key) throw new Error(t("media.badKey", "The file service saved this file in an unexpected place."));
  report(onProgress, "upload", 0);
  await putFile(link.url, link.headers, file, onProgress);
  report(onProgress, "confirm", 97);
  const confirmed = await gatekeeperCall("/v1/confirm", body, token);
  if (confirmed.ok !== true) throw new Error(t("media.confirmFailed", "The file could not be checked. Choose it again."));
  report(onProgress, "done", 100);
  return key;
}

function videoExtension(file: File): string | null {
  const type = file.type.toLowerCase();
  if (type === "video/mp4") return "mp4";
  if (type === "video/quicktime") return "mov";
  if (type === "video/webm") return "webm";
  return file.name.toLowerCase().match(/\.(mp4|mov|webm)$/)?.[1] ?? null;
}

async function videoDuration(file: File): Promise<number> {
  if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") return Number.NaN;
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  return new Promise((resolve) => {
    let done = false;
    const finish = (duration: number) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      resolve(duration);
    };
    const timer = setTimeout(() => finish(Number.NaN), 15000);
    video.onloadedmetadata = () => finish(video.duration);
    video.onerror = () => finish(Number.NaN);
    video.src = url;
  });
}

export async function uploadMediaFile({ uid, spaceId, shareWithSpace = false, file, kind, onProgress }: MediaUploadOptions): Promise<string> {
  const { user, token } = await currentUser(uid);
  if (!file || file.size <= 0) throw new Error(t("media.chooseFile", "Choose a file first."));
  const id = makeId();
  let blob: Blob = file;
  let extension = "jpg";
  let mediaClass: "user-media" | "space-media" | "video-intros" = "user-media";

  if (kind === "video") {
    if (!file.type.startsWith("video/")) throw new Error(t("media.chooseVideoFile", "Choose a video file."));
    const duration = await videoDuration(file);
    const videoReasons = getVideoReasons(file.size, duration);
    if (videoReasons.length) throw new Error(videoReasons.join(" "));
    const ext = videoExtension(file);
    if (!ext) throw new Error(t("media.videoFormat", "Choose an MP4, MOV, or WebM video."));
    extension = ext;
    mediaClass = "video-intros";
  } else if (kind === "attachment") {
    report(onProgress, "prepare", 0);
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (isPdf) {
      if (file.size > MAX_ATTACHMENT_BYTES) throw new Error(t("media.fileTooLarge", "File must be 5 MB or smaller."));
      if (await file.slice(0, 5).text() !== "%PDF-") throw new Error(t("media.attachment.format", "Choose a real PDF or photo file."));
      extension = "pdf";
    } else if (file.type.startsWith("image/")) {
      blob = await stripExif(file);
      if (blob.size <= 0 || blob.size > MAX_PHOTO_BYTES) throw new Error(t("media.photoTooLarge", "This photo is too big to send. Try a smaller one."));
      if (containsExifBytes(await blob.arrayBuffer())) throw new Error(t("media.exifNotStripped", "Photo details could not be removed. Choose another photo."));
      extension = "jpg";
    } else {
      throw new Error(t("media.attachment.format", "Choose a real PDF or photo file."));
    }
  } else {
    if (!file.type.startsWith("image/")) throw new Error(t("media.choosePhoto", "Choose a photo first."));
    report(onProgress, "prepare", 0);
    blob = await stripExif(file);
    if (blob.size <= 0 || blob.size > MAX_PHOTO_BYTES) throw new Error(t("media.photoTooLarge", "This photo is too big to send. Try a smaller one."));
    if (containsExifBytes(await blob.arrayBuffer())) throw new Error(t("media.exifNotStripped", "Photo details could not be removed. Choose another photo."));
    if (kind === "child" && shareWithSpace && !spaceId) throw new Error(t("media.chooseSpace", "Choose a care space before sharing a child photo."));
    extension = "jpg";
    mediaClass = (kind === "child" && shareWithSpace) || (kind === "gallery" && spaceId) ? "space-media" : "user-media";
  }

  const key = mediaKeyFor({ uid: user.uid, spaceId, shareWithSpace, kind, id, extension });
  if (!key) throw new Error(t("media.badLocation", "Could not choose a safe place for this file."));
  const keySpaceId = key.startsWith("spaces/") ? spaceId : undefined;
  return uploadToGatekeeper({ token, uid: user.uid, key, mediaClass, spaceId: keySpaceId, file: blob, onProgress });
}

export async function uploadQualificationDocument({ uid, file, onProgress }: DocumentUploadOptions): Promise<string> {
  const { user, token } = await currentUser(uid);
  if (!file || file.size <= 0) throw new Error(t("media.chooseFile", "Choose a file first."));
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isImage = file.type === "image/jpeg" || file.type === "image/png";
  if (!isPdf && !isImage) throw new Error(t("quals.fileType", "Choose a PDF, JPG, or PNG file."));
  if (file.size > MAX_PHOTO_BYTES) throw new Error(t("media.fileTooLarge", "File must be 5 MB or smaller."));
  report(onProgress, "prepare", 0);
  const blob = isImage ? await stripExif(file) : file;
  if (isImage && containsExifBytes(await blob.arrayBuffer())) throw new Error(t("media.exifNotStripped", "Photo details could not be removed. Choose another photo."));
  const key = mediaKeyFor({ uid: user.uid, kind: "document", id: makeId(), extension: isPdf ? "pdf" : "jpg" });
  if (!key) throw new Error(t("media.badLocation", "Could not choose a safe place for this file."));
  return uploadToGatekeeper({ token, uid: user.uid, key, mediaClass: "user-media", file: blob, onProgress });
}

export async function getPrivateMediaUrl(key: string): Promise<string | null> {
  if (!key || !/^(users\/[A-Za-z0-9_-]{1,128}\/|spaces\/[A-Za-z0-9_-]{1,128}\/)/.test(key)) return null;
  try {
    const { user, token } = await currentUser();
    const link = await gatekeeperCall("/v1/link", { op: "get", key, ownerUid: user.uid }, token);
    return link.url && Number(link.expiresIn) === PRESIGNED_LINK_SECONDS ? link.url : null;
  } catch { return null; }
}
