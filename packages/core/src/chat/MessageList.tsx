import { useEffect, useMemo, useRef, useState } from "react";
import { t } from "../i18n";
import { Bunny } from "../Bunny";
import { type ChatMessage, mergeMessageStreams, timeMs } from "./merge";
import { getPrivateMediaUrl } from "../media/upload";

export type MessageListProps = { uid: string; messages: readonly ChatMessage[]; label?: string };
const clock = (value: unknown) => {
  const ms = timeMs(value);
  return ms ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(ms)) : "";
};
const day = (value: unknown) => {
  const ms = timeMs(value);
  return ms ? new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date(ms)) : "";
};

export function MessageList({ uid, messages, label }: MessageListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const ordered = useMemo(() => mergeMessageStreams(messages), [messages]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let live = true;
    const keys = [...new Set(ordered.map((message) => message.img).filter((key): key is string => Boolean(key && !/^https?:\/\//i.test(key))))];
    void Promise.all(keys.map(async (key) => [key, await getPrivateMediaUrl(key)] as const)).then((pairs) => {
      if (live) setImageUrls((current) => ({ ...current, ...Object.fromEntries(pairs.filter((pair): pair is readonly [string, string] => Boolean(pair[1]))) }));
    });
    return () => { live = false; };
  }, [ordered]);

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    const frame = requestAnimationFrame(() => { node.scrollTop = node.scrollHeight; });
    return () => cancelAnimationFrame(frame);
  }, [ordered.length, ordered[ordered.length - 1]?.id]);

  return <div ref={listRef} role="log" aria-label={label ?? t("chat.messages.label", "Messages")} aria-live="polite" aria-relevant="additions text" style={{ display: "flex", flex: 1, minHeight: 0, flexDirection: "column", gap: 9, overflowY: "auto", padding: "12px 14px" }}>
    {ordered.length ? ordered.map((message, index) => {
      const own = message.from === uid;
      const previous = ordered[index - 1];
      const date = new Date(timeMs(message.at)).toDateString();
      const newDay = !previous || new Date(timeMs(previous.at)).toDateString() !== date;
      const image = message.img ? (/^https?:\/\//i.test(message.img) ? message.img : imageUrls[message.img]) : undefined;
      return <div key={message.id ?? `${message.from}-${timeMs(message.at)}-${index}`} style={{ display: "flex", flexDirection: "column", alignItems: own ? "flex-end" : "flex-start", gap: 6 }}>
        {newDay && <div style={{ alignSelf: "center", padding: "4px 10px", borderRadius: 99, background: "var(--soft)", color: "var(--muted)", fontSize: 15 }}>{day(message.at)}</div>}
        <article style={{ maxWidth: "min(84%, 520px)", padding: "10px 13px", borderRadius: own ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: own ? "var(--ink)" : "var(--card)", color: own ? "var(--cream)" : "var(--text)", boxShadow: "var(--shadow)", overflowWrap: "anywhere" }}>
          {image && <img src={image} alt={t("chat.photo.alt", "Shared photo")} loading="lazy" style={{ display: "block", width: "100%", maxWidth: 260, borderRadius: 12, marginBlockEnd: 8 }} />}
          {message.kind === "photo" && !image && <p style={{ margin: 0 }}>{t("chat.photo.shared", "Photo shared")}</p>}
          {message.text && <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{message.text}</p>}
          {message.kind === "photoAsk" && !message.text && <p style={{ margin: 0 }}>{t("chat.photo.request", "Photo update requested")}</p>}
          <footer style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBlockStart: 5, fontSize: 14, opacity: 0.82 }}>
            <time>{clock(message.at)}</time>
            {own && <span>{message.queued ? t("chat.delivery.queued", "Waiting to send") : message.pending ? t("chat.delivery.sending", "Sending") : t("chat.delivery.sent", "Sent")}</span>}
          </footer>
        </article>
      </div>;
    }) : <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 180, textAlign: "center", color: "var(--muted)" }}>
      <Bunny mood="hello" size={78} />
      <p style={{ margin: 0 }}>{t("chat.first.message", "Say hello when you are ready.")}</p>
    </div>}
  </div>;
}
