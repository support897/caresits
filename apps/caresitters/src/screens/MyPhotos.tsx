import { useCallback, useEffect, useRef, useState } from "react";
import { BackBar, getPrivateMediaUrl, saveProfile, t, toast, uploadMediaFile, useNav, type Person } from "@cc/core";

const MAX = 6;
const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, MAX) : []);
/** Photos you added: see them, add more (up to 6), remove, and pick the main one. */
export default function MyPhotos({ params }: { params: { me: Person } }) {
  const nav = useNav(); const me = params.me; const fileRef = useRef<HTMLInputElement>(null);
  const [keys, setKeys] = useState<string[]>(list(me.card.gallery));
  const [main, setMain] = useState<number>(typeof me.card.mainPhotoIndex === "number" ? me.card.mainPhotoIndex : 0);
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  useEffect(() => { let live = true; void Promise.all(keys.map(async (k) => [k, await getPrivateMediaUrl(k)] as const)).then((rows) => { if (live) setUrls(Object.fromEntries(rows)); }); return () => { live = false; }; }, [keys]);
  const persist = useCallback(async (next: string[], nextMain: number) => {
    const m = next.length ? Math.min(Math.max(nextMain, 0), next.length - 1) : 0;
    await saveProfile(me.uid, { card: { gallery: next, mainPhotoIndex: m }, ...(next[m] ? { photoUrl: next[m] } : {}) });
    setKeys(next); setMain(m);
  }, [me.uid]);
  async function add(file?: File) {
    if (!file || keys.length >= MAX) return; setBusy(true); setErr("");
    try { const key = await uploadMediaFile({ uid: me.uid, file, kind: "gallery" }); await persist([...keys, key], keys.length ? main : 0); toast(t("photos.added", "Photo added")); }
    catch { setErr(t("photos.fail", "Could not add that photo. Try a smaller picture.")); }
    setBusy(false);
  }
  async function remove(i: number) { setBusy(true); setErr(""); try { await persist(keys.filter((_, x) => x !== i), i < main ? main - 1 : main === i ? 0 : main); } catch { setErr(t("photos.saveFail", "Could not save. Try again.")); } setBusy(false); }
  async function makeMain(i: number) { setBusy(true); setErr(""); try { await persist(keys, i); toast(t("photos.mainSet", "Main photo set")); } catch { setErr(t("photos.saveFail", "Could not save. Try again.")); } setBusy(false); }
  return <div style={{ height: "100%", overflowY: "auto", background: "var(--cream)" }}>
    <BackBar title={t("photos.title", "My photos")} onBack={() => nav.back()} />
    <div style={{ padding: 16 }}>
      <p className="muted">{t("photos.help", "Up to {max} photos. Shown on your profile.", { max: MAX })}</p>
      <div data-testid="my-photos" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        {keys.map((k, i) => <figure key={k} className="card" style={{ margin: 0, padding: 8 }}>
          {urls[k] ? <img src={urls[k] as string} alt={t("photos.alt", "Photo {n}", { n: i + 1 })} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 14 }} /> : <div className="sk" style={{ aspectRatio: "1", borderRadius: 14 }} />}
          <figcaption style={{ display: "grid", gap: 6, marginBlockStart: 8 }}>
            {i === main ? <span className="chip" style={{ justifyContent: "center" }}>{t("photos.main", "Main photo")}</span> : <button type="button" className="btn alt" disabled={busy} onClick={() => void makeMain(i)}>{t("photos.makeMain", "Make main")}</button>}
            <button type="button" className="btn alt" disabled={busy} onClick={() => void remove(i)} aria-label={t("photos.removeN", "Remove photo {n}", { n: i + 1 })}>{t("photos.remove", "Remove")}</button>
          </figcaption>
        </figure>)}
      </div>
      {keys.length === 0 && <p>{t("photos.none", "No photos yet.")}</p>}
      <input ref={fileRef} type="file" accept="image/*" hidden aria-label={t("photos.pick", "Choose a photo")} onChange={(e) => { void add(e.target.files?.[0]); e.target.value = ""; }} />
      <button className="btn" type="button" disabled={busy || keys.length >= MAX} onClick={() => fileRef.current?.click()} style={{ marginBlockStart: 16 }}>{keys.length >= MAX ? t("photos.full", "You have {max} photos", { max: MAX }) : t("photos.add", "Add a photo")}</button>
      {err && <p role="alert">{err}</p>}
    </div>
  </div>;
}
