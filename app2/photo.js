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

export function planResumePath(uid, fileName) {
  if (!uid || !fileName) return null;
  const safe = String(fileName).replace(/[^A-Za-z0-9._]/g, "_");
  if (!safe) return null;
  return `resumes/${uid}/${safe}`;
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

export async function uploadToStorage(path, blob) {
  try {
    if (typeof window !== "undefined" && typeof window.CARESITS_UPLOAD === "function") {
      const url = await window.CARESITS_UPLOAD(path, blob);
      return { ok: true, url };
    }
    const cfgMod = await import("./firebase-config.js");
    const appMod = await import(`${SDK}/firebase-app.js`);
    const storageMod = await import(`${SDK}/firebase-storage.js`);
    const existing = typeof appMod.getApps === "function"
      ? appMod.getApps().find((a) => a.name === "app2-photo")
      : null;
    const app = existing || appMod.initializeApp(cfgMod.firebaseConfig, "app2-photo");
    const storage = storageMod.getStorage(app);
    const ref = storageMod.ref(storage, path);
    await storageMod.uploadBytes(ref, blob);
    const url = await storageMod.getDownloadURL(ref);
    return { ok: true, url };
  } catch (e) {
    return { ok: false, reason: String((e && (e.code || e.message)) || e) };
  }
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
