import { t } from "../i18n";

export type PixelSize = { width: number; height: number };
export function resizeDimensions(width: number, height: number, maxSide = 1600): PixelSize | null {
  if (![width, height, maxSide].every(Number.isFinite) || width <= 0 || height <= 0 || maxSide <= 0) return null;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function containsExifBytes(value: ArrayBuffer | ArrayBufferView): boolean {
  const bytes = value instanceof ArrayBuffer
    ? new Uint8Array(value)
    : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  for (let i = 0; i <= bytes.length - 4; i += 1) {
    if (bytes[i] === 0x45 && bytes[i + 1] === 0x78 && bytes[i + 2] === 0x69 && bytes[i + 3] === 0x66) return true;
  }
  return false;
}

type OpenImage = { source: CanvasImageSource; width: number; height: number; close(): void };
async function openImage(file: Blob): Promise<OpenImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch { /* fall through to the image element for older web views */ }
  }
  if (typeof document === "undefined" || typeof Image === "undefined" || typeof URL.createObjectURL !== "function") {
    throw new Error(t("media.imageUnavailable", "Photo editing is not ready on this device."));
  }
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(t("media.imageUnreadable", "This photo could not be opened.")));
      image.src = objectUrl;
    });
    return { source: image, width: image.naturalWidth || image.width, height: image.naturalHeight || image.height, close: () => URL.revokeObjectURL(objectUrl) };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

export async function stripExif(file: Blob, maxSide = 1600): Promise<Blob> {
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
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.84));
    if (!blob) throw new Error(t("media.imageEncodeFailed", "This photo could not be prepared. Choose it again."));
    return blob;
  } finally { image.close(); }
}
