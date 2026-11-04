import { useEffect, useState } from "react";
import { BackBar, Button, MediaPicker, t, useNav, type ScreenProps } from "@cc/core";
import { type CarePerms, type CareRole } from "../data/children";
import { addGalleryItem, canShareGallery, getPrivateMediaUrl, loadGallery, setGalleryItemShared, type CareSpaceGalleryItem } from "../data/gallery";
import { CareEmpty, DemoNotice } from "./care/common";
import "./care/care.css";

type Params = { spaceId?: string; childId?: string; childName?: string; uid?: string; role?: CareRole; perms?: CarePerms; demo?: boolean };
type GalleryProps = ScreenProps<Params> & { onBack?: () => void };
const NO_PERMS: CarePerms = { allergies: false, medication: false, photos: false, calendar: false, privateMessages: false };
const demoMode = (explicit?: boolean) => explicit === true || (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1");
const dateText = (date: Date) => date.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

export default function Gallery({ params, onBack }: GalleryProps) {
  const nav = useNav();
  const demo = demoMode(params.demo);
  const spaceId = params.spaceId ?? "";
  const childId = params.childId ?? "";
  const role = params.role ?? (demo ? "admin" : "viewer");
  const perms = params.perms ?? NO_PERMS;
  const uid = params.uid ?? "";
  const canReadPhotos = role === "admin" || perms.photos;
  const canUploadPhotos = canReadPhotos && Boolean(uid);
  const [items, setItems] = useState<CareSpaceGalleryItem[]>([]);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [busyItem, setBusyItem] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const back = onBack ?? nav.back;

  useEffect(() => {
    let live = true;
    setLoading(true); setError("");
    if (demo || !spaceId || !canReadPhotos) {
      setItems([]); setMediaUrls({}); setLoading(false);
      return () => { live = false; };
    }
    loadGallery(spaceId, role).then(async (records) => {
      const scoped = records.filter((item) => !childId || !item.childId || item.childId === childId);
      if (live) setItems(scoped);
      const urls = await Promise.all(scoped.map(async (item) => [item.id, await getPrivateMediaUrl(item.key)] as const));
      if (live) setMediaUrls(Object.fromEntries(urls));
    }).catch(() => { if (live) setError(t("care.galleryLoadError", "Could not load photos and videos for this care space.")); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [spaceId, childId, role, canReadPhotos, demo]);

  const visibleItems = items;
  async function addPhoto(key: string) {
    if (!uid) { setError(t("care.galleryPhotoNeedsAccount", "Sign in again before adding a photo.")); return; }
    setError(""); setNotice("");
    try {
      const item = await addGalleryItem(spaceId, { key, kind: "photo", by: uid, ...(childId ? { childId } : {}) });
      setItems((current) => [item, ...current]);
      const url = await getPrivateMediaUrl(item.key);
      setMediaUrls((current) => ({ ...current, [item.id]: url }));
      setNotice(t("care.galleryPhotoAdded", "Photo added to this private care space."));
    } catch { setError(t("care.galleryPhotoSaveError", "The photo uploaded, but could not be added to this gallery.")); }
  }

  async function toggleSharing(item: CareSpaceGalleryItem) {
    if (!canShareGallery(role)) return;
    setBusyItem(item.id); setError(""); setNotice("");
    try {
      await setGalleryItemShared(spaceId, item.id, !item.sharedByParent, role);
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, sharedByParent: !entry.sharedByParent } : entry));
      setNotice(item.sharedByParent ? t("care.galleryUnshared", "Photo is private again.") : t("care.galleryShared", "Photo shared with the family."));
    } catch { setError(t("care.galleryShareError", "Could not change sharing. Ask a parent admin to try again.")); }
    finally { setBusyItem(""); }
  }

  return <div className="app">
    <BackBar title={params.childName ? t("care.childGalleryTitle", "{name}’s photos and videos", { name: params.childName }) : t("care.galleryTitle", "Photos and videos")} onBack={back} right={<span className="care-badge">{params.childName ?? t("care.privateGallery", "Private care space")}</span>} />
    <div className="scroll"><div className="care-wrap">
      {demo && <DemoNotice />}
      {error && <div className="care-info care-warning" role="alert">{error}</div>}
      {notice && <div className="care-status" role="status">{notice}</div>}
      <div className="care-head"><div><h1>{t("care.galleryHeading", "Care-space memories")}</h1><p>{t("care.galleryHint", "Photos and videos stay private. A parent controls when child media is shared with the family.")}</p></div></div>
      {canUploadPhotos && <div className="care-card">
        <h2>{t("care.galleryAddMedia", "Add a photo")}</h2>
        <p className="care-muted">{t("care.galleryUploadUnavailable", "Photo uploads use the private R2 file server. It is not deployed in this test environment, so uploads may fail. New video uploads are not supported yet; existing videos can still be viewed and shared.")}</p>
        <MediaPicker kind="gallery" uid={uid} spaceId={spaceId} buttonLabel={t("care.galleryChoosePhoto", "Choose a photo")} onDone={(key) => void addPhoto(key)} />
      </div>}
      {!canReadPhotos && <CareEmpty title={t("care.galleryNoAccess", "Photo access is off")} detail={t("care.galleryNoAccessDetail", "Ask a parent to update your photo permission for this care space.")} />}
      {loading && <CareEmpty title={t("care.galleryLoading", "Loading private gallery…")} />}
      {!loading && canReadPhotos && !visibleItems.length && <CareEmpty title={t("care.galleryEmpty", "No shared photos or videos yet")} detail={t("care.galleryEmptyDetail", "Photos and videos added to this care space will appear here. Child photos stay hidden until a parent shares them.")} />}
      {canReadPhotos && visibleItems.length > 0 && <div aria-label={t("care.galleryItems", "Care-space photos and videos")} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 12 }}>
        {visibleItems.map((item) => <article className="care-card" key={item.id} style={{ minWidth: 0, display: "grid", gap: 10 }}>
          {mediaUrls[item.id] ? item.kind === "video"
            ? <video controls preload="metadata" src={mediaUrls[item.id] ?? undefined} aria-label={t("care.galleryVideoAlt", "Care-space video")} style={{ width: "100%", maxHeight: 360, borderRadius: 14, background: "var(--soft)" }} />
            : <img src={mediaUrls[item.id] ?? undefined} alt={t("care.galleryPhotoAlt", "Care-space memory")} loading="lazy" style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 14, background: "var(--soft)" }} />
            : <div className="care-info" role="status">{t("care.galleryPreviewUnavailable", "A private preview is not available right now.")}</div>}
          <p className="care-muted">{t(item.kind === "video" ? "care.galleryVideo" : "care.galleryPhoto", item.kind === "video" ? "Video" : "Photo")} · {dateText(item.at)}</p>
          {item.childId && <span className="care-badge">{item.childId === childId ? params.childName ?? t("care.childMedia", "Child photo") : t("care.childMedia", "Child photo")}</span>}
          {canShareGallery(role) && item.childId && <Button alt onClick={() => void toggleSharing(item)} disabled={busyItem === item.id}>{item.sharedByParent ? t("care.galleryStopSharing", "Stop sharing with family") : t("care.galleryShare", "Share with family")}</Button>}
          {!item.childId && <span className="care-badge">{t("care.gallerySharedSpaceMedia", "Shared with this care space")}</span>}
          {item.childId && !item.sharedByParent && role === "admin" && <span className="care-muted">{t("care.galleryPrivateLabel", "Private until a parent shares it")}</span>}
        </article>)}
      </div>}
    </div></div>
  </div>;
}
