import { afterEach, describe, expect, it, vi } from "vitest";
import { containsExifBytes, resizeDimensions, stripExif } from "./exif";
import { getVideoReasons, mediaKeyFor } from "./upload";
import { MAX_VIDEO_BYTES } from "./config";

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

  it("applies the 60 second and 50 MB video limits", () => {
    expect(getVideoReasons(MAX_VIDEO_BYTES, 60)).toEqual([]);
    expect(getVideoReasons(MAX_VIDEO_BYTES + 1, 60).length).toBe(1);
    expect(getVideoReasons(10, 60.1).length).toBe(1);
  });
});
