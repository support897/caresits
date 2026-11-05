import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { getPrivateMediaUrl } from "./media/upload";

const cache = new Map<string, { url: string | null; at: number }>();
const TTL = 4 * 60 * 1000;
const direct = (s: string) => /^(https?:|data:|blob:)/.test(s);

/** Resolves a stored photo key (users/<uid>/...) to a short-lived link. Plain URLs pass straight through. */
export function useMediaUrl(src?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(() => (src && direct(src) ? src : src ? cache.get(src)?.url ?? null : null));
  useEffect(() => {
    let live = true;
    if (!src) { setUrl(null); return; }
    if (direct(src)) { setUrl(src); return; }
    const hit = cache.get(src);
    if (hit && Date.now() - hit.at < TTL && hit.url) { setUrl(hit.url); return; }
    void getPrivateMediaUrl(src).then((u) => { if (u) cache.set(src, { url: u, at: Date.now() }); if (live) setUrl(u); });
    return () => { live = false; };
  }, [src]);
  return url;
}

/** <img> that accepts a photo key or a URL. Renders nothing until a link is ready. */
export function MediaImg({ src, alt = "", ...rest }: Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { src?: string | null }) {
  const url = useMediaUrl(src);
  if (!url) return null;
  return <img src={url} alt={alt} {...rest} />;
}
