// USAGE: import { stripAndResize, uploadPhoto, videoChecks } from "./media.js". Keep returned keys private until a parent shares them.
import { t } from "./tr.js";
import { MEDIA_GATEKEEPER_BASE_URL } from "./media-config.js";

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 60;
export const PRESIGNED_LINK_SECONDS = 300;

const SAFE_SEGMENT = /^[A-Za-z0-9_-]{1,128}$/;
const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;

export function resizeDimensions(width, height, maxSide = 1600) {
  if (![width, height, maxSide].every(Number.isFinite) || width <= 0 || height <= 0 || maxSide <= 0) return null;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function containsExifBytes(value) {
  let bytes;
  if (value instanceof ArrayBuffer) bytes = new Uint8Array(value);
  else if (ArrayBuffer.isView(value)) bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  else return false;
  for (let i = 0; i <= bytes.length - 4; i += 1) {
    if (bytes[i] === 0x45 && bytes[i + 1] === 0x78 && bytes[i + 2] === 0x69 && bytes[i + 3] === 0x66) return true;
  }
  return false;
}

async function openImage(file) {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => { if (typeof bitmap.close === "function") bitmap.close(); },
      };
    } catch { /* older phone formats may need the Image fallback */ }
  }
  if (typeof document === "undefined" || typeof Image === "undefined" || !URL.createObjectURL) {
    throw new Error(t("media.imageUnavailable", "Photo editing is not ready on this device."));
  }
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error(t("media.imageUnreadable", "This photo could not be opened.")));
      image.src = objectUrl;
    });
    return {
      source: image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      close: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

export async function stripAndResize(file, maxSide = 1600) {
  if (!file) throw new Error(t("media.choosePhoto", "Choose a photo first."));
  if (typeof document === "undefined") throw new Error(t("media.imageUnavailable", "Photo editing is not ready on this device."));
  const image = await openImage(file);
  try {
    const size = resizeDimensions(image.width, image.height, maxSide);
    if (!size) throw new Error(t("media.imageUnreadable", "This photo could not be opened."));
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error(t("media.imageUnavailable", "Photo editing is not ready on this device."));
    context.drawImage(image.source, 0, 0, size.width, size.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.84));
    if (!blob) throw new Error(t("media.imageEncodeFailed", "This photo could not be prepared. Choose it again."));
    return blob;
  } finally {
    image.close();
  }
}

export function getVideoReasons(size, duration) {
  const reasons = [];
  if (!Number.isFinite(size) || size <= 0) return [t("media.chooseVideo", "Choose a video first.")];
  if (size > MAX_VIDEO_BYTES) reasons.push(t("media.videoTooLarge", "Video must be 50 MB or smaller."));
  if (!Number.isFinite(duration) || duration <= 0) reasons.push(t("media.videoLengthUnknown", "The video length could not be checked."));
  else if (duration > MAX_VIDEO_SECONDS) reasons.push(t("media.videoTooLong", "Video must be 60 seconds or shorter."));
  return reasons;
}

export async function videoChecks(file) {
  if (!file || !Number.isFinite(file.size) || file.size <= 0) return [t("media.chooseVideo", "Choose a video first.")];
  if (file.type && !file.type.startsWith("video/")) return [t("media.chooseVideoFile", "Choose a video file.")];
  if (file.size > MAX_VIDEO_BYTES) return [t("media.videoTooLarge", "Video must be 50 MB or smaller.")];
  if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") {
    return [t("media.videoLengthUnknown", "The video length could not be checked.")];
  }

  let objectUrl;
  let video;
  try {
    objectUrl = URL.createObjectURL(file);
    video = document.createElement("video");
    video.hidden = true;
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("aria-hidden", "true");
    video.tabIndex = -1;
    video.style.position = "fixed";
    video.style.width = "1px";
    video.style.height = "1px";
    video.style.opacity = "0";
    video.style.pointerEvents = "none";
  } catch {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    return [t("media.videoLengthUnknown", "The video length could not be checked.")];
  }

  return new Promise((resolve) => {
    let finished = false;
    const finish = (duration) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      video.onloadedmetadata = null;
      video.onerror = null;
      try { video.pause(); } catch { /* nothing to stop */ }
      try { video.removeAttribute("src"); video.load(); } catch { /* old web views may not support reload */ }
      if (typeof video.remove === "function") video.remove();
      else if (document.body && typeof document.body.removeChild === "function") {
        try { document.body.removeChild(video); } catch { /* it may not have been attached */ }
      }
      URL.revokeObjectURL(objectUrl);
      resolve(getVideoReasons(file.size, duration));
    };
    const timer = setTimeout(() => finish(NaN), 15000);
    video.onloadedmetadata = () => finish(video.duration);
    video.onerror = () => finish(NaN);
    try {
      if (document.body && typeof document.body.appendChild === "function") document.body.appendChild(video);
      video.src = objectUrl;
      video.load();
    } catch {
      finish(NaN);
    }
  });
}

export function getMediaKey({ uid, spaceId, kind, id, extension } = {}) {
  if (!SAFE_SEGMENT.test(uid || "") || !SAFE_ID.test(id || "")) return null;
  const ext = String(extension || "").toLowerCase().replace(/^\./, "");
  if (!/^(jpg|mp4|mov|webm)$/.test(ext)) return null;
  if (kind === "avatar" && ext === "jpg") return `users/${uid}/photos/avatar-${id}.jpg`;
  if (kind === "gallery" && ext === "jpg") {
    if (spaceId && !SAFE_SEGMENT.test(spaceId)) return null;
    return spaceId
      ? `spaces/${spaceId}/gallery/photo-${id}.jpg`
      : `users/${uid}/gallery/photo-${id}.jpg`;
  }
  if (kind === "child" && ext === "jpg" && SAFE_SEGMENT.test(spaceId || "")) {
    return `spaces/${spaceId}/children/child-${id}.jpg`;
  }
  if (kind === "video" && /^(mp4|mov|webm)$/.test(ext)) return `users/${uid}/videos/intro-${id}.${ext}`;
  return null;
}

function fileId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

function videoExtension(file) {
  const type = String(file.type || "").toLowerCase();
  if (type === "video/mp4") return "mp4";
  if (type === "video/quicktime") return "mov";
  if (type === "video/webm") return "webm";
  const name = String(file.name || "").toLowerCase();
  const match = name.match(/\.(mp4|mov|webm)$/);
  return match ? match[1] : null;
}

function uploadClass(kind, spaceId) {
  if (kind === "video") return "video-intros";
  if (kind === "child" || (kind === "gallery" && spaceId)) return "space-media";
  return "user-media";
}

function friendlyGatekeeperError(status, error) {
  if (status === 401) return t("media.signInAgain", "Your sign-in expired. Sign in again.");
  if (status === 403) return t("media.noAccess", "You do not have access to save this file.");
  if (status === 404) return t("media.serviceMissing", "The file service is not ready yet.");
  if (status === 409) return t("media.linkExpired", "Upload took too long. Choose the file again.");
  if (status === 413 || error === "bad size") return t("media.fileTooLarge", "This file is too large to save.");
  if (status === 429) return t("media.uploadLimit", "Please wait before uploading another file.");
  if (status === 400) return t("media.mediaTypeNotReady", "This photo or video type is not set up on the file service yet.");
  if (status >= 500) return t("media.serviceProblem", "The file service had a problem. Try again later.");
  return t("media.uploadFailed", "Could not upload this file. Try again.");
}

async function gatekeeperCall(route, body, token) {
  let response;
  try {
    response = await fetch(`${MEDIA_GATEKEEPER_BASE_URL.replace(/\/$/, "")}${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(t("media.serviceOffline", "Could not reach the file service. Try again when you are online."));
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) throw new Error(friendlyGatekeeperError(response.status, result && result.error));
  return result;
}

function reportProgress(callback, stage, percent) {
  if (typeof callback !== "function") return;
  try { callback({ stage, percent }); } catch { /* progress display must not stop an upload */ }
}

function putWithProgress(url, headers, blob, callback) {
  if (typeof XMLHttpRequest !== "function") {
    const safeHeaders = Object.fromEntries(Object.entries(headers || {}).filter(([name]) => name.toLowerCase() !== "content-length"));
    return fetch(url, { method: "PUT", headers: safeHeaders, body: blob }).then((response) => {
      if (!response.ok) throw new Error(t("media.uploadFailed", "Could not upload this file. Try again."));
      reportProgress(callback, "upload", 95);
    }).catch((error) => {
      if (error instanceof Error && error.message === t("media.uploadFailed", "Could not upload this file. Try again.")) throw error;
      throw new Error(t("media.uploadFailed", "Could not upload this file. Try again."));
    });
  }
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url, true);
    Object.entries(headers || {}).forEach(([name, value]) => {
      if (name.toLowerCase() === "content-length") return;
      request.setRequestHeader(name, String(value));
    });
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) reportProgress(callback, "upload", Math.min(95, Math.round((event.loaded / event.total) * 95)));
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error(t("media.uploadFailed", "Could not upload this file. Try again.")));
    };
    request.onerror = () => reject(new Error(t("media.uploadFailed", "Could not upload this file. Try again.")));
    request.onabort = () => reject(new Error(t("media.uploadFailed", "Upload stopped. Choose the file again.")));
    request.send(blob);
  });
}

export async function uploadPhoto({ uid, spaceId, file, kind, onProgress } = {}) {
  if (!["avatar", "child", "gallery", "video"].includes(kind)) {
    throw new Error(t("media.kindNotReady", "This file type is not ready to upload."));
  }
  if (!file) throw new Error(kind === "video" ? t("media.chooseVideo", "Choose a video first.") : t("media.choosePhoto", "Choose a photo first."));
  if (kind === "child" && !SAFE_SEGMENT.test(spaceId || "")) {
    throw new Error(t("media.chooseSpace", "Choose a care space before adding a child photo."));
  }

  let user;
  try {
    const { auth } = await import("./data.js");
    user = auth().currentUser;
  } catch {
    throw new Error(t("media.signInAgain", "Your sign-in expired. Sign in again."));
  }
  if (!user || !user.uid) throw new Error(t("media.signInAgain", "Your sign-in expired. Sign in again."));
  if (uid && uid !== user.uid) throw new Error(t("media.noAccess", "You do not have access to save this file."));

  const actualUid = user.uid;
  const id = fileId();
  let bodyFile = file;
  let extension = "jpg";
  if (kind === "video") {
    const reasons = await videoChecks(file);
    if (reasons.length) throw new Error(reasons.join(" "));
    extension = videoExtension(file);
    if (!extension) throw new Error(t("media.videoFormat", "Choose an MP4, MOV, or WebM video."));
  } else {
    reportProgress(onProgress, "prepare", 0);
    bodyFile = await stripAndResize(file);
    if (bodyFile.size > MAX_PHOTO_BYTES) throw new Error(t("media.photoTooLarge", "Photo must be 5 MB or smaller."));
    if (bodyFile.size <= 0) throw new Error(t("media.imageEncodeFailed", "This photo could not be prepared. Choose it again."));
  }

  const key = getMediaKey({ uid: actualUid, spaceId, kind, id, extension });
  if (!key) throw new Error(t("media.badLocation", "Could not choose a safe place for this file."));
  const name = key.slice(key.lastIndexOf("/") + 1);
  const mediaClass = uploadClass(kind, spaceId);
  const baseBody = {
    class: mediaClass,
    name,
    ownerUid: actualUid,
    bytes: bodyFile.size,
    ...(spaceId ? { spaceId } : {}),
  };

  let token;
  try { token = await user.getIdToken(); }
  catch { throw new Error(t("media.signInAgain", "Your sign-in expired. Sign in again.")); }
  if (!token) throw new Error(t("media.signInAgain", "Your sign-in expired. Sign in again."));

  reportProgress(onProgress, "link", 0);
  const door = await gatekeeperCall("/v1/link", { ...baseBody, op: "put" }, token);
  if (!door.url || !door.headers || Number(door.expiresIn) !== PRESIGNED_LINK_SECONDS) {
    throw new Error(t("media.badLink", "The file service did not give a safe five-minute upload link."));
  }
  reportProgress(onProgress, "upload", 0);
  await putWithProgress(door.url, door.headers, bodyFile, onProgress);
  reportProgress(onProgress, "confirm", 97);
  const confirmed = await gatekeeperCall("/v1/confirm", baseBody, token);
  if (confirmed.ok !== true) throw new Error(t("media.confirmFailed", "The file could not be checked. Choose it again."));
  if (door.key && door.key !== key) throw new Error(t("media.badKey", "The file service saved this file in an unexpected place."));
  reportProgress(onProgress, "done", 100);
  return key;
}
