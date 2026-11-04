// USAGE: <MediaPicker kind="avatar|child|gallery|video" onDone={(key) => saveMediaKey(key)} />. Pass spaceId for child photos.
import React, { useEffect, useRef, useState } from "react";
import { uploadPhoto } from "./media.js";
import { t } from "./tr.js";

const labels = {
  avatar: { title: "Add a profile photo", hint: "Choose a photo or use your camera." },
  child: { title: "Add a child photo", hint: "Choose a photo or use your camera." },
  gallery: { title: "Add a gallery photo", hint: "Choose a photo or use your camera." },
  video: { title: "Add a video introduction", hint: "Choose a video or use your camera." },
};

const progressText = (stage, kind) => {
  if (stage === "prepare") return t("media.preparing", "Preparing photo…");
  if (stage === "link") return t("media.privateLink", "Getting a private upload link…");
  if (stage === "confirm") return t("media.checking", "Checking the file…");
  if (stage === "done") return t("media.complete", "Upload complete.");
  if (stage === "checking") return t("media.videoChecking", "Checking video length and size…");
  return kind === "video" ? t("media.videoUploading", "Uploading video…") : t("media.photoUploading", "Uploading photo…");
};

export function MediaPicker({ kind = "avatar", onDone, uid, spaceId }) {
  const inputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ stage: "", percent: 0 });
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const isVideo = kind === "video";
  const copy = labels[kind] || labels.avatar;

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const chooseFile = () => {
    if (!busy) inputRef.current?.click();
  };

  const handlePick = async (event) => {
    const file = event.currentTarget.files && event.currentTarget.files[0];
    event.currentTarget.value = "";
    if (!file) return;
    setError("");
    setStatus("");
    setProgress({ stage: isVideo ? "checking" : "prepare", percent: 0 });
    try {
      setPreviewUrl(URL.createObjectURL(file));
    } catch {
      setError(t("media.previewFailed", "This file could not be previewed."));
      return;
    }

    setBusy(true);
    try {
      const key = await uploadPhoto({
        uid,
        spaceId,
        file,
        kind,
        onProgress: (next) => setProgress(next),
      });
      setProgress({ stage: "done", percent: 100 });
      setStatus(t("media.complete", "Upload complete."));
      if (typeof onDone === "function") {
        try {
          await onDone(key);
        } catch {
          setError(t("media.savedNotAdded", "The file is saved, but it could not be added to this screen."));
        }
      }
    } catch (cause) {
      setProgress({ stage: "", percent: 0 });
      setError(cause instanceof Error && cause.message ? cause.message : t("media.uploadFailed", "Could not upload this file. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const tileStyle = {
    boxSizing: "border-box",
    width: "100%",
    minHeight: 172,
    padding: "24px 18px",
    border: "2px dashed #1E4D44",
    borderRadius: 22,
    background: "#FDF8F0",
    color: "#1E4D44",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    textAlign: "center",
    fontFamily: "inherit",
    cursor: busy ? "wait" : "pointer",
    opacity: busy ? 0.75 : 1,
  };

  return (
    <section style={{ width: "100%", maxWidth: 520, color: "#1E4D44" }}>
      <input
        ref={inputRef}
        type="file"
        accept={isVideo ? "video/*" : "image/*"}
        capture="environment"
        onChange={handlePick}
        aria-label={t("media.fileInput", copy.title)}
        style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 }}
      />
      <button
        type="button"
        onClick={chooseFile}
        disabled={busy}
        style={tileStyle}
        aria-busy={busy}
      >
        <span aria-hidden="true" style={{
          boxSizing: "border-box",
          width: 46,
          height: 38,
          border: "3px solid #1E4D44",
          borderRadius: 10,
          display: "grid",
          placeItems: "center",
          position: "relative",
        }}>
          <span style={{ width: 14, height: 14, border: "3px solid #1E4D44", borderRadius: "50%" }} />
        </span>
        <span style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.25 }}>{t(`media.title.${kind}`, copy.title)}</span>
        <span style={{ fontSize: 17, lineHeight: 1.4 }}>{t(`media.hint.${kind}`, copy.hint)}</span>
      </button>

      {kind === "child" && (
        <p style={{ margin: "12px 2px 0", fontSize: 17, lineHeight: 1.45 }}>
          {t("media.childPrivacy", "Photos of children stay private until a parent shares them")}
        </p>
      )}

      {previewUrl && (
        <div style={{ marginTop: 14, borderRadius: 16, overflow: "hidden", background: "#E6EEE9" }}>
          {isVideo ? (
            <video src={previewUrl} controls playsInline muted style={{ display: "block", width: "100%", maxHeight: 300, objectFit: "contain" }} />
          ) : (
            <img src={previewUrl} alt={t("media.previewAlt", "Selected photo preview")} style={{ display: "block", width: "100%", maxHeight: 300, objectFit: "contain" }} />
          )}
        </div>
      )}

      {busy && (
        <div style={{ marginTop: 12 }} aria-live="polite">
          <p style={{ margin: "0 0 6px", fontSize: 17 }}>{progressText(progress.stage, kind)}</p>
          <progress value={progress.percent} max="100" aria-label={t("media.progress", "Upload progress")} style={{ display: "block", width: "100%", minHeight: 18, accentColor: "#1E4D44" }} />
        </div>
      )}
      {status && <p role="status" style={{ margin: "12px 0 0", fontSize: 17, lineHeight: 1.4 }}>{status}</p>}
      {error && <p role="alert" style={{ margin: "12px 0 0", color: "#8B1E26", fontSize: 17, lineHeight: 1.4 }}>{error}</p>}
    </section>
  );
}

export default MediaPicker;
