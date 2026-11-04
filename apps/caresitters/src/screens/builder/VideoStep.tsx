import { useEffect, useState } from "react";
import { Button, getPrivateMediaUrl, t, uploadMediaFile } from "@cc/core";

export function VideoStep({ uid, videoKey, onSaved }: { uid: string; videoKey: string; onSaved: (key?: string) => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!videoKey) { setUrl(""); return; }
    let live = true;
    void getPrivateMediaUrl(videoKey).then((value) => { if (live && value) setUrl(value); });
    return () => { live = false; };
  }, [videoKey]);
  async function choose(file?: File) {
    if (!file) return;
    setError(""); setBusy(true);
    try { onSaved(await uploadMediaFile({ uid, kind: "video", file })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t("onb.video.error", "Could not save this video. Try again.")); }
    finally { setBusy(false); }
  }
  return <div className="onb-media-step">
    {url && <video className="onb-video-preview" src={url} controls playsInline preload="metadata" aria-label={t("onb.video.preview", "Video introduction preview")} />}
    <label className="onb-file-label">{t("onb.video.label", "Choose an introduction video")}
      <input className="field" type="file" accept="video/mp4,video/quicktime,video/webm" aria-label={t("onb.video.input", "Choose a video file")} disabled={busy} onChange={(event) => void choose(event.currentTarget.files?.[0])} />
    </label>
    <p className="muted onb-note">{busy ? t("onb.video.uploading", "Saving your video…") : t("onb.video.help", "Optional. Keep it under 60 seconds.")}</p>
    {videoKey && <Button type="button" alt small onClick={() => onSaved(undefined)}>{t("onb.video.remove", "Remove video")}</Button>}
    {error && <p role="alert" className="onb-error">{error}</p>}
  </div>;
}
