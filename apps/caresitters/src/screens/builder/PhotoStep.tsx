import { useEffect, useState } from "react";
import { Button, getPrivateMediaUrl, t, uploadMediaFile } from "@cc/core";

export function PhotoStep({ uid, photoKey, onSaved, label = t("onb.photo.label", "Choose a profile photo"), help = t("onb.photo.help", "Choose a clear photo of yourself. Your photo is saved securely.") }: { uid: string; photoKey: string; onSaved: (key: string) => void; label?: string; help?: string }) {
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!photoKey) { setPreview(""); return; }
    let live = true;
    void getPrivateMediaUrl(photoKey).then((url) => { if (live && url) setPreview(url); });
    return () => { live = false; };
  }, [photoKey]);
  useEffect(() => () => { if (preview.startsWith("blob:")) URL.revokeObjectURL(preview); }, [preview]);
  async function choose(file?: File) {
    if (!file) return;
    setError("");
    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setBusy(true);
    try { onSaved(await uploadMediaFile({ uid, kind: "avatar", file })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t("onb.photo.error", "Could not save this photo. Try again.")); }
    finally { setBusy(false); }
  }
  return <div className="onb-media-step">
    <div className="onb-photo-frame">{preview ? <img src={preview} alt={t("onb.photo.previewAlt", "Preview of your profile photo")} /> : <span aria-hidden="true">♡</span>}</div>
    <label className="onb-file-label"><span>{preview ? t("onb.photo.change", "Change photo") : label}</span>
      <input className="field" type="file" accept="image/*" aria-label={t("onb.photo.input", "Choose a profile photo file")} disabled={busy} onChange={(event) => void choose(event.currentTarget.files?.[0])} />
    </label>
    <p className="muted onb-note">{busy ? t("onb.photo.uploading", "Saving your photo…") : help}</p>
    {photoKey && <Button type="button" alt small disabled={busy} onClick={() => { setPreview(""); onSaved(""); }}>{t("onb.photo.remove", "Remove photo")}</Button>}
    {error && <p role="alert" className="onb-error">{error}</p>}
  </div>;
}
