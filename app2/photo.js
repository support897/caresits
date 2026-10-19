// Caresitters app2 photo helpers
// Paths are pure so they can be proven without a network
// Uploads fail soft and never throw to the surface

const SDK = "../accounts/sdk";

export function planPhotoPath(uid) {
  if (!uid) return null;
  return `profile-photos/${uid}/photo.jpg`;
}

// F14: the gallery's slots live beside the main photo, one
// file per slot, so a slot can be replaced on its own.
export function planGalleryPath(uid, slot) {
  if (!uid) return null;
  if (!Number.isInteger(slot) || slot < 1 || slot > 4) return null;
  return `profile-photos/${uid}/extra-${slot}.jpg`;
}

export async function downscaleImage(file, max = 1024) {
  if (typeof document === "undefined") {
    throw new Error("browser-only");
  }
  if (!file) throw new Error("missing-file");
  let source = null;
  let width = 0;
  let height = 0;
  let bitmap = null;
  let objectUrl = null;
  if (typeof createImageBitmap === "function") {
    bitmap = await createImageBitmap(file);
    source = bitmap;
    width = bitmap.width;
    height = bitmap.height;
  } else {
    objectUrl = URL.createObjectURL(file);
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("image-load-failed"));
      img.src = objectUrl;
    });
    source = img;
    width = img.naturalWidth || img.width;
    height = img.naturalHeight || img.height;
  }
  try {
    const longSide = Math.max(width, height);
    const scale = longSide > 0 ? Math.min(1, max / longSide) : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.82);
    });
    if (!blob) throw new Error("image-encode-failed");
    return blob;
  } finally {
    if (bitmap && typeof bitmap.close === "function") bitmap.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

async function storageSdk() {
  const cfgMod = await import("./firebase-config.js");
  const appMod = await import(`${SDK}/firebase-app.js`);
  const storageMod = await import(`${SDK}/firebase-storage.js`);
  // The DEFAULT app only, shared with the door: a named app carries
  // its own auth session and would never see the signed-in user (R1).
  const existing = typeof appMod.getApps === "function"
    ? appMod.getApps().find((a) => a.name === "[DEFAULT]")
    : null;
  const app = existing || appMod.initializeApp(cfgMod.firebaseConfig);
  return { storageMod, storage: storageMod.getStorage(app) };
}

export async function uploadToStorage(path, blob) {
  try {
    if (typeof window !== "undefined" && typeof window.CARESITS_UPLOAD === "function") {
      const url = await window.CARESITS_UPLOAD(path, blob);
      return { ok: true, url };
    }
    const { storageMod, storage } = await storageSdk();
    const ref = storageMod.ref(storage, path);
    await storageMod.uploadBytes(ref, blob);
    const url = await storageMod.getDownloadURL(ref);
    return { ok: true, url };
  } catch (e) {
    return { ok: false, reason: String((e && (e.code || e.message)) || e) };
  }
}

// Deletion (HQ ruling, 19 Oct 2026): removing a photo or a
// resume in the app must remove the object itself. A list entry
// dropped while its file stays in the bucket is an orphan, and
// orphan personal files are a fail. Only the two roots this app
// writes can ever be derived from a URL.
export function planPathFromUrl(url) {
  if (typeof url !== "string" || !url) return null;
  const m = url.match(/\/o\/([^?#]+)/);
  if (!m) return null;
  try {
    const p = decodeURIComponent(m[1]);
    return p.startsWith("profile-photos/") || p.startsWith("resumes/") ? p : null;
  } catch {
    return null;
  }
}

export async function deleteFromStorage(path) {
  try {
    if (!path) return { ok: false, reason: "missing-path" };
    if (typeof window !== "undefined" && typeof window.CARESITS_DELETE_FILE === "function") {
      await window.CARESITS_DELETE_FILE(path);
      return { ok: true };
    }
    const { storageMod, storage } = await storageSdk();
    await storageMod.deleteObject(storageMod.ref(storage, path));
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: String((e && (e.code || e.message)) || e) };
  }
}

export async function removeProfilePhoto(uid) {
  return deleteFromStorage(planPhotoPath(uid));
}

export async function removeGalleryPhoto(uid, slot) {
  return deleteFromStorage(planGalleryPath(uid, slot));
}

function readAsDataUrl(blob) {
  if (typeof FileReader === "undefined" || !blob) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    } catch {
      resolve(null);
    }
  });
}

async function uploadPhotoTo(path, file) {
  let downscaled = null;
  try {
    downscaled = await downscaleImage(file, 1024);
  } catch (e) {
    const dataUrl = await readAsDataUrl(file);
    return { ok: false, reason: String((e && (e.code || e.message)) || e), dataUrl };
  }
  if (!path) {
    // No account on this device (the demo): the pick still
    // answers with the picture itself, previewed here with the
    // honest device only line. Nothing is uploaded, and the
    // tap is never a silent no-op.
    const dataUrl = await readAsDataUrl(downscaled);
    return { ok: false, reason: "missing-uid", dataUrl };
  }
  const result = await uploadToStorage(path, downscaled);
  if (result.ok) return { ok: true, url: result.url };
  const dataUrl = await readAsDataUrl(downscaled);
  return { ok: false, reason: result.reason || "upload-failed", dataUrl };
}

export async function uploadProfilePhoto(uid, file) {
  if (!file) return { ok: false, reason: "missing-file" };
  return uploadPhotoTo(planPhotoPath(uid), file);
}

// F14: one gallery slot, the same seam and the same soft
// failures as the main photo (F12's demo preview included).
export async function uploadGalleryPhoto(uid, file, slot) {
  if (!file) return { ok: false, reason: "missing-file" };
  return uploadPhotoTo(planGalleryPath(uid, slot), file);
}
