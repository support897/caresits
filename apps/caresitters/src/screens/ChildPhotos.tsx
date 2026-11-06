import { useCallback, useEffect, useRef, useState } from "react";
import { BackBar, BunnyAgent, agentSay, getPrivateMediaUrl, t, toast, uploadMediaFile, useNav, type Person } from "@cc/core";
import { loadChildPhotoKeys, mergeKids, saveChildPhotoKey, type KidRow } from "../data/childPhotos";

/** Optional private photo for each child. Only the parent sees these until they choose to share. */
export default function ChildPhotos({ params }: { params: { me: Person } }) {
  const nav = useNav(); const me = params.me; const fileRef = useRef<HTMLInputElement>(null); const target = useRef<KidRow | null>(null);
  const [photos, setPhotos] = useState<Record<string, string>>({}); const [urls, setUrls] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(""); const [err, setErr] = useState("");
  const kids = mergeKids(me.card.kids, photos);
  useEffect(() => { let live = true; void loadChildPhotoKeys(me.uid).then((p) => { if (live) { setPhotos(p); setLoading(false); } }).catch(() => { if (live) { setErr(t("kids.loadFail", "Could not load your children's photos. Try again.")); setLoading(false); } }); return () => { live = false; }; }, [me.uid]);
  useEffect(() => { let live = true; void Promise.all(Object.values(photos).map(async (k) => [k, await getPrivateMediaUrl(k)] as const)).then((rows) => { if (live) setUrls(Object.fromEntries(rows)); }); return () => { live = false; }; }, [photos]);
  const setKey = useCallback(async (kid: KidRow, key: string) => { await saveChildPhotoKey(me.uid, kid, key); setPhotos((p) => { const n = { ...p }; if (key) n[kid.id] = key; else delete n[kid.id]; return n; }); }, [me.uid]);
  async function add(file?: File) {
    const kid = target.current; if (!file || !kid) return; setBusy(kid.id); setErr(""); agentSay("upload-start");
    try { const key = await uploadMediaFile({ uid: me.uid, file, kind: "child" }); await setKey(kid, key); agentSay("upload-done"); toast(t("kids.added", "Photo saved privately")); }
    catch { agentSay("upload-failed"); setErr(t("kids.fail", "Could not save that photo. Try a smaller picture.")); }
    setBusy("");
  }
  async function remove(kid: KidRow) { setBusy(kid.id); setErr(""); try { await setKey(kid, ""); } catch { setErr(t("kids.removeFail", "Could not remove it. Try again.")); } setBusy(""); }
  return <div style={{ height: "100%", overflowY: "auto", background: "var(--cream)" }}>
    <BackBar title={t("kids.title", "Children's photos")} onBack={() => nav.back()} />
    <div style={{ padding: 16 }}>
      <p className="muted" data-testid="kids-privacy">{t("kids.privacy", "Optional. These photos are private. Only you can see them unless you choose to share them.")}</p>
      {loading && <div className="sk" style={{ height: 120 }} />}
      {!loading && kids.length === 0 && <p>{t("kids.none", "Add a child in your family profile first.")}</p>}
      <div data-testid="child-photos" style={{ display: "grid", gap: 12 }}>
        {kids.map((kid) => { const url = kid.photoKey ? urls[kid.photoKey] : null; return <section key={kid.id} className="card" style={{ display: "flex", gap: 12, alignItems: "center", padding: 12 }}>
          {url ? <img src={url} alt={t("kids.alt", "Photo of {name}", { name: kid.name })} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 16 }} /> : <div className="sk" aria-hidden="true" style={{ width: 72, height: 72, borderRadius: 16 }} />}
          <div style={{ flex: 1, minWidth: 0 }}><strong>{kid.name}</strong>{kid.ageYears !== null && <div className="muted">{t("kids.age", "{n} years", { n: kid.ageYears })}</div>}</div>
          <div style={{ display: "grid", gap: 6 }}>
            <button type="button" className="btn alt" disabled={busy !== ""} onClick={() => { target.current = kid; fileRef.current?.click(); }}>{kid.photoKey ? t("kids.change", "Change") : t("kids.add", "Add photo")}</button>
            {kid.photoKey && <button type="button" className="btn alt" disabled={busy !== ""} onClick={() => void remove(kid)} aria-label={t("kids.removeN", "Remove photo of {name}", { name: kid.name })}>{t("kids.remove", "Remove")}</button>}
          </div></section>; })}
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden aria-label={t("kids.pick", "Choose a photo")} onChange={(e) => { void add(e.target.files?.[0]); e.target.value = ""; }} />
      {err && <p role="alert">{err}</p>}
    </div>
    <BunnyAgent size={52} />
  </div>;
}
