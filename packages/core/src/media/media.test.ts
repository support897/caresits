import { afterEach, describe, expect, it, vi } from "vitest";
import { containsExifBytes, resizeDimensions, stripExif } from "./exif";
import { getVideoReasons, mediaAttachmentKind, mediaKeyFor } from "./upload";
import { MAX_ATTACHMENT_BYTES, MAX_VIDEO_BYTES } from "./config";

afterEach(() => vi.unstubAllGlobals());

describe("private media helpers", () => {
  it("re-encodes photos without Exif marker bytes", async () => {
    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: vi.fn() }),
      toBlob: (callback: BlobCallback) => callback(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" })),
    };
    vi.stubGlobal("document", { createElement: () => fakeCanvas });
    vi.stubGlobal("createImageBitmap", async () => ({ width: 100, height: 50, close: vi.fn() }));
    const output = await stripExif(new Blob(["source"]));
    expect(containsExifBytes(await output.arrayBuffer())).toBe(false);
    expect(fakeCanvas.width).toBe(100);
    expect(fakeCanvas.height).toBe(50);
  });

  it("scales large photos without changing their shape", () => {
    expect(resizeDimensions(3200, 1600)).toEqual({ width: 1600, height: 800 });
  });

  it("keeps keys inside the user or space prefixes", () => {
    expect(mediaKeyFor({ uid: "u_1", kind: "avatar", id: "x1", extension: "jpg" })).toBe("users/u_1/photos/avatar-x1.jpg");
    expect(mediaKeyFor({ uid: "u_1", spaceId: "s_1", kind: "child", id: "x1", extension: "jpg" })).toBe("users/u_1/children/child-x1.jpg");
    expect(mediaKeyFor({ uid: "u_1", spaceId: "s_1", shareWithSpace: true, kind: "child", id: "x1", extension: "jpg" })).toBe("spaces/s_1/children/child-x1.jpg");
    expect(mediaKeyFor({ uid: "u/1", kind: "avatar", id: "x1", extension: "jpg" })).toBeNull();
  });

  it("keeps chat attachments private, typed, and within the upload limit", () => {
    expect(MAX_ATTACHMENT_BYTES).toBe(5 * 1024 * 1024);
    expect(mediaKeyFor({ uid: "u_1", kind: "attachment", id: "x1", extension: "pdf" })).toBe("users/u_1/attachments/attachment-x1.pdf");
    expect(mediaAttachmentKind("users/u_1/attachments/attachment-x1.pdf")).toBe("pdf");
    expect(mediaAttachmentKind("users/u_1/gallery/photo-x1.jpg")).toBe("image");
    expect(mediaAttachmentKind("https://example.invalid/child.jpg")).toBeNull();
    expect(mediaAttachmentKind("users/u_1/../../photo.jpg")).toBeNull();
  });

  it("applies the 60 second and 50 MB video limits", () => {
    expect(getVideoReasons(MAX_VIDEO_BYTES, 60)).toEqual([]);
    expect(getVideoReasons(MAX_VIDEO_BYTES + 1, 60).length).toBe(1);
    expect(getVideoReasons(10, 60.1).length).toBe(1);
  });
});

describe("any-size photos", () => {
  it("shrinks until the result fits the limit", async () => {
    let calls = 0;
    vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage: vi.fn() }),
      toBlob: (cb: BlobCallback, _t: string, q: number) => { calls++; cb(new Blob([new Uint8Array(q > 0.7 ? 6_000_000 : 1_000_000)], { type: "image/jpeg" })); } }) });
    vi.stubGlobal("createImageBitmap", async () => ({ width: 8000, height: 6000, close: vi.fn() }));
    const out = await stripExif(new Blob([new Uint8Array(30_000_000)], { type: "image/heic" }));
    expect(out.size).toBeLessThanOrEqual(4.5 * 1024 * 1024); expect(calls).toBeGreaterThan(1);
  });
});

import { assertRealImage, dedupeUpload, isTransientError, sniffImageType, withRetry } from "./validate";
describe("upload reliability", () => {
  it("sniffs real image types from bytes", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("jpeg");
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))).toBe("png");
    expect(sniffImageType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("webp");
    expect(sniffImageType(new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]))).toBe("heic");
    expect(sniffImageType(new TextEncoder().encode("<html>not an image"))).toBeNull();
  });
  it("rejects a file renamed to .jpg but not an image", async () => {
    await expect(assertRealImage(new File(["<?php evil ?>"], "cat.jpg", { type: "image/jpeg" }))).rejects.toThrow(/not a photo/);
  });
  it("retries transient failures only", async () => {
    let n = 0;
    const slept: number[] = [];
    const ok = await withRetry(async () => { if (++n < 3) throw new Error("Could not reach the file service. Try again when you are online."); return "done"; }, { sleep: async (ms) => { slept.push(ms); } });
    expect(ok).toBe("done"); expect(n).toBe(3); expect(slept).toEqual([600, 1200]);
    let m = 0;
    await expect(withRetry(async () => { m++; throw new Error("You do not have access to save this file."); }, { sleep: async () => {} })).rejects.toThrow(/access/);
    expect(m).toBe(1);
    expect(isTransientError(new Error("This file is too large to save."))).toBe(false);
  });
  it("cancel stops retries", async () => {
    const c = new AbortController(); c.abort();
    await expect(withRetry(async () => "x", { signal: c.signal })).rejects.toThrow(/stopped/);
  });
  it("duplicate taps share one upload", async () => {
    let runs = 0;
    const start = () => new Promise<string>((r) => setTimeout(() => { runs++; r("k"); }, 5));
    const [a, b] = await Promise.all([dedupeUpload("same", start), dedupeUpload("same", start)]);
    expect(a).toBe("k"); expect(b).toBe("k"); expect(runs).toBe(1);
  });
});
