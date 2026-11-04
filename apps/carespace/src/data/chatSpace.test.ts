import { beforeEach, describe, expect, it, vi } from "vitest";

const { readSnapshot, saveSnapshot, writeSpaceDocument } = vi.hoisted(() => ({
  readSnapshot: vi.fn(() => ({ savedAt: "", data: [] })),
  saveSnapshot: vi.fn(),
  writeSpaceDocument: vi.fn(),
}));

vi.mock("./offline", () => ({
  isConnectivityError: vi.fn(),
  readSnapshot,
  saveSnapshot,
  writeSpaceDocument,
}));

import { filterInboxRows, isCareSpaceGalleryPhotoKey, normalizeSpaceMessage, postSpacePhoto } from "./chatSpace";

const rows = [
  { space: { id: "own", ownerUid: "me" }, unread: 0, hasRequest: false },
  { space: { id: "family-a", ownerUid: "parent-a" }, unread: 2, hasRequest: false },
  { space: { id: "family-b", ownerUid: "parent-b" }, unread: 0, hasRequest: true },
];

describe("Care Space inbox", () => {
  it("filters family-owned and carer-owned spaces by the signed-in person, not their member role", () => {
    expect(filterInboxRows(rows, "Families", "me").map((row) => row.space.id)).toEqual(["family-a", "family-b"]);
    expect(filterInboxRows(rows, "Carers", "me").map((row) => row.space.id)).toEqual(["own"]);
    expect(filterInboxRows(rows, "Unread", "me").map((row) => row.space.id)).toEqual(["family-a"]);
    expect(filterInboxRows(rows, "Requests", "me").map((row) => row.space.id)).toEqual(["family-b"]);
  });

  it("normalizes Firestore server timestamps before sorting or reading messages", () => {
    const message = normalizeSpaceMessage("message-1", {
      from: "carer", text: "Ready for pickup", kind: "text",
      at: { toDate: () => new Date("2026-11-04T08:30:00.000Z") },
    });
    expect(message).toMatchObject({ id: "message-1", from: "carer", at: "2026-11-04T08:30:00.000Z" });
  });
});

describe("private Care Space photos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readSnapshot.mockReturnValue({ savedAt: "", data: [] });
    writeSpaceDocument.mockResolvedValue({ queued: true });
  });

  it("accepts only a gallery key from the same space", () => {
    expect(isCareSpaceGalleryPhotoKey("space-1", "spaces/space-1/gallery/photo-a1.jpg")).toBe(true);
    expect(isCareSpaceGalleryPhotoKey("space-1", "spaces/space-2/gallery/photo-a1.jpg")).toBe(false);
    expect(isCareSpaceGalleryPhotoKey("space-1", "https://example.test/private.jpg")).toBe(false);
    expect(isCareSpaceGalleryPhotoKey("space-1", "spaces/space-1/gallery/../../child.jpg")).toBe(false);
  });

  it("queues a photo message only for a role with photo access", async () => {
    const key = "spaces/space-1/gallery/photo-a1.jpg";
    const result = await postSpacePhoto("space-1", "carer-1", "regular", key, {
      allergies: false, medication: false, photos: true, calendar: false, privateMessages: true,
    });
    expect(result).toMatchObject({ queued: true, message: { from: "carer-1", kind: "photo", img: key, text: "" } });
    expect(writeSpaceDocument).toHaveBeenCalledWith(expect.objectContaining({
      path: expect.stringMatching(/^careSpaces\/space-1\/messages\//),
      data: { from: "carer-1", kind: "photo", img: key, text: "", at: expect.any(String) },
    }));
    await expect(postSpacePhoto("space-1", "carer-1", "regular", key, {
      allergies: false, medication: false, photos: false, calendar: false, privateMessages: true,
    })).rejects.toThrow("This role cannot share photos.");
  });
});
