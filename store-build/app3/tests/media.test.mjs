// Run with: node tests/media.test.mjs
import assert from "node:assert/strict";
import {
  containsExifBytes,
  getMediaKey,
  getVideoReasons,
  resizeDimensions,
  stripAndResize,
  videoChecks,
} from "../src/media.js";

assert.deepEqual(resizeDimensions(4000, 2000, 1600), { width: 1600, height: 800 });
assert.deepEqual(resizeDimensions(800, 1200, 1600), { width: 800, height: 1200 });
assert.deepEqual(getVideoReasons(50 * 1024 * 1024, 60), []);
assert.deepEqual(getVideoReasons(50 * 1024 * 1024 + 1, 20), ["Video must be 50 MB or smaller."]);
assert.deepEqual(getVideoReasons(4, 60.1), ["Video must be 60 seconds or shorter."]);
assert.equal(getMediaKey({ uid: "user12345", kind: "avatar", id: "abc123", extension: "jpg" }), "users/user12345/photos/avatar-abc123.jpg");
assert.equal(getMediaKey({ uid: "user12345", spaceId: "space_123", kind: "child", id: "abc123", extension: "jpg" }), "spaces/space_123/children/child-abc123.jpg");
assert.equal(getMediaKey({ uid: "user12345", kind: "gallery", id: "abc123", extension: "jpg" }), "users/user12345/gallery/photo-abc123.jpg");
assert.equal(getMediaKey({ uid: "user12345", spaceId: "bad/space", kind: "gallery", id: "abc123", extension: "jpg" }), null);
assert.equal(getMediaKey({ uid: "user12345", kind: "child", id: "abc123", extension: "jpg" }), null);

const exifInput = new Blob([new Uint8Array([0xff, 0xd8, 0xff]), "Exif\u0000\u0000GPS data"], { type: "image/jpeg" });
assert.equal(containsExifBytes(new Uint8Array(await exifInput.arrayBuffer())), true);

const savedDocument = globalThis.document;
const savedCreateImageBitmap = globalThis.createImageBitmap;
let canvasSeen;
let bitmapClosed = false;
try {
  globalThis.createImageBitmap = async () => ({ width: 4000, height: 2000, close() { bitmapClosed = true; } });
  globalThis.document = {
    createElement(tag) {
      assert.equal(tag, "canvas");
      canvasSeen = {
        width: 0,
        height: 0,
        getContext(kind) {
          assert.equal(kind, "2d");
          return { drawImage() {} };
        },
        toBlob(done, type) {
          assert.equal(type, "image/jpeg");
          done(new Blob([new Uint8Array([0xff, 0xd8, 0xff]), "clean pixels only"], { type }));
        },
      };
      return canvasSeen;
    },
  };

  const encoded = await stripAndResize(exifInput, 1600);
  assert.equal(encoded.type, "image/jpeg");
  assert.equal(canvasSeen.width, 1600);
  assert.equal(canvasSeen.height, 800);
  assert.equal(containsExifBytes(new Uint8Array(await encoded.arrayBuffer())), false, "canvas re-encode must drop the input Exif marker");
  assert.equal(bitmapClosed, true);
} finally {
  if (savedDocument === undefined) delete globalThis.document;
  else globalThis.document = savedDocument;
  if (savedCreateImageBitmap === undefined) delete globalThis.createImageBitmap;
  else globalThis.createImageBitmap = savedCreateImageBitmap;
}

const savedVideoDocument = globalThis.document;
const oldCreateObjectURL = URL.createObjectURL;
const oldRevokeObjectURL = URL.revokeObjectURL;
let videoSeen;
try {
  URL.createObjectURL = () => "blob:test-video";
  URL.revokeObjectURL = () => {};
  globalThis.document = {
    body: { appendChild(node) { videoSeen = node; }, removeChild() {} },
    createElement(tag) {
      assert.equal(tag, "video");
      return {
        hidden: false,
        style: {},
        duration: 61,
        load() { queueMicrotask(() => { if (typeof this.onloadedmetadata === "function") this.onloadedmetadata(); }); },
        pause() {},
        setAttribute() {},
        removeAttribute() {},
      };
    },
  };
  assert.deepEqual(await videoChecks({ size: 1024, type: "video/mp4" }), ["Video must be 60 seconds or shorter."]);
  assert.equal(videoSeen.hidden, true);
  assert.equal(videoSeen.preload, "metadata");
} finally {
  if (savedVideoDocument === undefined) delete globalThis.document;
  else globalThis.document = savedVideoDocument;
  URL.createObjectURL = oldCreateObjectURL;
  URL.revokeObjectURL = oldRevokeObjectURL;
}

console.log("media tests passed");
