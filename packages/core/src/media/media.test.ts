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
