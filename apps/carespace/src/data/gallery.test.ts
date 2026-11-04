import { describe, expect, it } from "vitest";
import { canShareGallery, canViewGalleryItem, isGalleryKeyForSpace, visibleGalleryItems, type CareSpaceGalleryItem } from "./gallery";

const galleryItem = (id: string, childId?: string, sharedByParent = false): CareSpaceGalleryItem => ({
  id, key: `spaces/space-1/gallery/${id}.jpg`, kind: "photo", by: "member-1", at: new Date("2026-11-04T10:00:00.000Z"),
  ...(childId ? { childId } : {}), sharedByParent,
});

describe("CareSpace gallery privacy", () => {
  it("hides unshared child media from non-admin members but keeps general media visible", () => {
    const items = [galleryItem("private", "child-1"), galleryItem("shared", "child-1", true), galleryItem("space-photo")];
    expect(visibleGalleryItems(items, "regular").map((item) => item.id)).toEqual(["shared", "space-photo"]);
    expect(visibleGalleryItems(items, "viewer").map((item) => item.id)).toEqual(["shared", "space-photo"]);
  });

  it("lets admins see private child media and only admins share it", () => {
    const privateItem = galleryItem("private", "child-1");
    expect(canViewGalleryItem(privateItem, "admin")).toBe(true);
    expect(visibleGalleryItems([privateItem], "admin")).toEqual([privateItem]);
    expect(canShareGallery("admin")).toBe(true);
    expect(canShareGallery("regular")).toBe(false);
    expect(canShareGallery("viewer")).toBe(false);
  });

  it("accepts only media keys from the same CareSpace", () => {
    expect(isGalleryKeyForSpace("space-1", "spaces/space-1/gallery/photo-a.jpg")).toBe(true);
    expect(isGalleryKeyForSpace("space-1", "spaces/space-2/gallery/photo-a.jpg")).toBe(false);
    expect(isGalleryKeyForSpace("space-1", "spaces/space-1/gallery/../photo-a.jpg")).toBe(false);
  });
});
