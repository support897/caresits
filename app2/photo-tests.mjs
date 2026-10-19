import assert from "node:assert/strict";
let n = 0;
const t = (name, fn) => { fn(); n += 1; console.log("ok -", name); };
const ta = async (name, fn) => { await fn(); n += 1; console.log("ok -", name); };
globalThis.window = { CARESITS_UPLOAD: async (path) => "stub:" + path };
const photo = await import("./photo.js");
const { planPhotoPath, planGalleryPath, planResumePath, uploadToStorage, downscaleImage } = photo;
t("photo path shape", () => { assert.equal(planPhotoPath("u1"), "profile-photos/u1/photo.jpg"); });
t("photo path refuses empty uid", () => { assert.equal(planPhotoPath(""), null); assert.equal(planPhotoPath(null), null); assert.equal(planPhotoPath(undefined), null); });
t("resume path shape", () => { assert.equal(planResumePath("u1", "cv.pdf"), "resumes/u1/cv.pdf"); });
t("resume path refuses empty uid", () => { assert.equal(planResumePath("", "cv.pdf"), null); });
t("resume path refuses empty name", () => { assert.equal(planResumePath("u1", ""), null); assert.equal(planResumePath("u1", null), null); });
t("resume path sanitises spaces", () => { assert.equal(planResumePath("u1", "my resume.pdf"), "resumes/u1/my_resume.pdf"); });
t("resume path sanitises symbols", () => { assert.equal(planResumePath("u1", "a/b:c*d?.pdf"), "resumes/u1/a_b_c_d_.pdf"); });
t("resume path sanitises brackets", () => { assert.equal(planResumePath("u1", "resume (final).pdf"), "resumes/u1/resume__final_.pdf"); });
t("resume path keeps dots and underscores", () => { assert.equal(planResumePath("u1", "my_cv.v2.pdf"), "resumes/u1/my_cv.v2.pdf"); });
t("resume path replaces the dash char in a name", () => { assert.equal(planResumePath("u1", "my-cv.pdf"), "resumes/u1/my_cv.pdf"); });
await ta("upload through the seam returns ok and url", async () => { const r = await uploadToStorage("profile-photos/u1/photo.jpg", new Blob(["x"])); assert.equal(r.ok, true); assert.equal(r.url, "stub:profile-photos/u1/photo.jpg"); });
await ta("upload seam sees the exact path", async () => { let seen = null; globalThis.window.CARESITS_UPLOAD = async (path) => { seen = path; return "stub:" + path; }; const r = await uploadToStorage("resumes/u1/cv.pdf", new Blob(["x"])); assert.equal(seen, "resumes/u1/cv.pdf"); assert.equal(r.url, "stub:resumes/u1/cv.pdf"); });
await ta("seam throwing returns ok false and no throw escapes", async () => { globalThis.window.CARESITS_UPLOAD = async () => { throw new Error("boom"); }; const r = await uploadToStorage("profile-photos/u1/photo.jpg", new Blob(["x"])); assert.equal(r.ok, false); assert.ok(typeof r.reason === "string" && r.reason.length > 0); });
await ta("downscale guards the browser only shape", async () => { await assert.rejects(() => downscaleImage(new Blob(["x"]))); });
// F12: a photo pick with no account (the demo) must answer with
// a device preview, never silence. The browser pieces the
// downscale needs are stubbed the way the upload seam is above.
globalThis.createImageBitmap = async () => ({ width: 800, height: 600, close() {} });
globalThis.document = {
  createElement: () => ({
    width: 0, height: 0,
    getContext: () => ({ drawImage() {} }),
    toBlob: (cb) => cb(new Blob(["jpg"], { type: "image/jpeg" })),
  }),
};
globalThis.FileReader = class {
  readAsDataURL() { this.result = "data:image/jpeg;base64,stub"; if (this.onload) this.onload(); }
};
await ta("demo photo pick answers with a device preview (F12)", async () => {
  let seamCalls = 0;
  globalThis.window.CARESITS_UPLOAD = async () => { seamCalls += 1; return "stub:unused"; };
  const r = await photo.uploadProfilePhoto(undefined, new Blob(["x"]));
  assert.equal(r.ok, false);
  assert.equal(r.reason, "missing-uid");
  assert.ok(typeof r.dataUrl === "string" && r.dataUrl.startsWith("data:"));
  assert.equal(seamCalls, 0);
});
await ta("signed in photo pick still uploads through the seam (F12)", async () => {
  let seen = null;
  globalThis.window.CARESITS_UPLOAD = async (path) => { seen = path; return "stub:" + path; };
  const r = await photo.uploadProfilePhoto("u1", new Blob(["x"]));
  assert.equal(r.ok, true);
  assert.equal(seen, "profile-photos/u1/photo.jpg");
  assert.equal(r.url, "stub:profile-photos/u1/photo.jpg");
});
// F14: the gallery slots live beside the main photo, one
// file per slot, and a gallery pick behaves exactly like the
// main photo pick (F12's demo preview included).
t("gallery path shape", () => { assert.equal(planGalleryPath("u1", 2), "profile-photos/u1/extra-2.jpg"); });
t("gallery path refuses empty uid", () => { assert.equal(planGalleryPath("", 1), null); assert.equal(planGalleryPath(null, 1), null); assert.equal(planGalleryPath(undefined, 1), null); });
t("gallery path refuses slots outside one to four", () => { assert.equal(planGalleryPath("u1", 0), null); assert.equal(planGalleryPath("u1", 5), null); assert.equal(planGalleryPath("u1", 2.5), null); assert.equal(planGalleryPath("u1", "2"), null); });
await ta("demo gallery pick answers with a device preview (F14)", async () => {
  let seamCalls = 0;
  globalThis.window.CARESITS_UPLOAD = async () => { seamCalls += 1; return "stub:unused"; };
  const r = await photo.uploadGalleryPhoto(undefined, new Blob(["x"]), 1);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "missing-uid");
  assert.ok(typeof r.dataUrl === "string" && r.dataUrl.startsWith("data:"));
  assert.equal(seamCalls, 0);
});
await ta("signed in gallery pick uploads to its slot path (F14)", async () => {
  let seen = null;
  globalThis.window.CARESITS_UPLOAD = async (path) => { seen = path; return "stub:" + path; };
  const r = await photo.uploadGalleryPhoto("u1", new Blob(["x"]), 3);
  assert.equal(r.ok, true);
  assert.equal(seen, "profile-photos/u1/extra-3.jpg");
  assert.equal(r.url, "stub:profile-photos/u1/extra-3.jpg");
});
// S-2: the resume picker uploads PDFs alone. The handler
// lives in trust.js; this leg pins its shape: the upload call
// stands inside the PDF branch, after the head check, and no
// upload stands on the text path that ends in runDraft.
await ta("resume picker uploads only inside the PDF branch (S-2)", async () => {
  const { readFileSync } = await import("node:fs");
  const trust = readFileSync(new URL("./trust.js", import.meta.url), "utf8");
  const start = trust.indexOf("rfile.addEventListener");
  const end = trust.indexOf("readBtn.addEventListener", start);
  assert.ok(start > 0 && end > start, "the resume file handler stands in trust.js");
  const handler = trust.slice(start, end);
  const pdfAt = handler.indexOf('head.startsWith("%PDF")');
  const uploadAt = handler.indexOf("uploadToStorage(");
  const draftAt = handler.indexOf("runDraft(");
  assert.ok(pdfAt >= 0 && uploadAt > pdfAt, "the upload stands after the PDF head check");
  assert.ok(draftAt > uploadAt, "the text path drafts after the PDF branch");
  assert.ok(!handler.slice(draftAt).includes("uploadToStorage"), "no upload rides the text path");
});
t("deletion: a Firebase download URL gives back its object path", () => {
  const u = "https://firebasestorage.googleapis.com/v0/b/caresits-812a0.firebasestorage.app/o/profile-photos%2Fu1%2Fextra-2.jpg?alt=media&token=x";
  assert.equal(photo.planPathFromUrl(u), "profile-photos/u1/extra-2.jpg");
  assert.equal(photo.planPathFromUrl("https://firebasestorage.googleapis.com/v0/b/b/o/resumes%2Fu1%2Fmy%20cv.pdf?alt=media"), "resumes/u1/my cv.pdf");
});
t("deletion: non storage URLs and foreign roots give no path", () => {
  assert.equal(photo.planPathFromUrl("data:image/jpeg;base64,AAAA"), null);
  assert.equal(photo.planPathFromUrl("https://example.com/o/other%2Fthing.jpg"), null);
  assert.equal(photo.planPathFromUrl(""), null);
  assert.equal(photo.planPathFromUrl(null), null);
});
await ta("deletion: the removers delete exactly their planned objects through the seam", async () => {
  const gone = [];
  globalThis.window.CARESITS_DELETE_FILE = async (p) => { gone.push(p); };
  assert.deepEqual(await photo.deleteFromStorage(""), { ok: false, reason: "missing-path" });
  assert.equal((await photo.removeProfilePhoto("u9")).ok, true);
  assert.equal((await photo.removeGalleryPhoto("u9", 3)).ok, true);
  assert.equal((await photo.removeGalleryPhoto("u9", 9)).ok, false);
  assert.equal((await photo.removeResumeObject("u9", "my cv.pdf")).ok, true);
  assert.deepEqual(gone, ["profile-photos/u9/photo.jpg", "profile-photos/u9/extra-3.jpg", "resumes/u9/my_cv.pdf"]);
  delete globalThis.window.CARESITS_DELETE_FILE;
});

console.log(`\nALL ${n} photo checks passed`);
