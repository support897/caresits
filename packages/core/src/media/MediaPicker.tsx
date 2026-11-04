import { useRef, useState } from "react";
import { Bunny } from "../Bunny";
import { t } from "../i18n";
import { type MediaKind, type UploadProgress, uploadMediaFile } from "./upload";

export type MediaPickerProps = {
  kind: MediaKind;
  onDone(key: string): void;
  uid?: string;
  spaceId?: string;
  buttonLabel?: string;
};

export function MediaPicker({ kind, onDone, uid, spaceId, buttonLabel }: MediaPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [shareWithSpace, setShareWithSpace] = useState(false);
  const isVideo = kind === "video";
  async function choose(file?: File) {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    setProgress(null);
    try {
      const key = await uploadMediaFile({ uid, spaceId, shareWithSpace, file, kind, onProgress: setProgress });
      onDone(key);
      if (inputRef.current) inputRef.current.value = "";
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("media.uploadFailed", "Could not upload this file. Try again."));
    } finally { setBusy(false); }
  }
  return <section aria-label={t("media.picker.label", "Choose a photo or video")} style={{ display: "grid", gap: 8, minWidth: 0 }}>
    <input ref={inputRef} type="file" accept={isVideo ? "video/mp4,video/quicktime,video/webm" : "image/*"} aria-label={isVideo ? t("media.video.label", "Choose video") : t("media.photo.label", "Choose photo")} onChange={(event) => void choose(event.currentTarget.files?.[0])} style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }} />
    <button type="button" className="btn alt" onClick={() => inputRef.current?.click()} disabled={busy} style={{ minHeight: 48 }}>
      {busy ? t("media.uploading", "Preparing your file…") : buttonLabel ?? (isVideo ? t("media.addVideo", "Add a video") : t("media.addPhoto", "Add a photo"))}
    </button>
    {kind === "child" && <p style={{ margin: 0, color: "var(--muted)" }}>{t("media.child.private", "Photos of children stay private until a parent shares them")}</p>}
    {kind === "child" && spaceId && <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44 }}><input type="checkbox" checked={shareWithSpace} onChange={(event) => setShareWithSpace(event.target.checked)} style={{ width: 22, height: 22, accentColor: "var(--ink)" }} /><span>{t("media.child.share", "Share with this care space")}</span></label>}
    {!busy && !progress && <div style={{ display: "flex", justifyContent: "center" }}><Bunny mood="point" size={50} /></div>}
    {progress && <p role="status" style={{ margin: 0, color: "var(--muted)" }}>{t(`media.stage.${progress.stage}`, progress.stage === "done" ? "File saved" : progress.stage === "confirm" ? "Checking your file…" : progress.stage === "upload" ? "Saving your file…" : progress.stage === "link" ? "Preparing a secure link…" : "Preparing your file…")} {progress.percent ? `${progress.percent}%` : ""}</p>}
    {error && <p role="alert" style={{ margin: 0, color: "var(--danger)" }}>{error}</p>}
  </section>;
}
