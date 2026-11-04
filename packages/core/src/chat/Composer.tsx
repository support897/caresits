import { useState, type FormEvent, type KeyboardEvent } from "react";
import { t } from "../i18n";

export type ComposerProps = {
  onSend(text: string): void | Promise<void>;
  disabled?: boolean;
  sending?: boolean;
  maxLength?: number;
};

export function Composer({ onSend, disabled = false, sending = false, maxLength = 1000 }: ComposerProps) {
  const [draft, setDraft] = useState("");
  const canSend = draft.trim().length > 0 && !disabled && !sending;
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || disabled || sending) return;
    void onSend(text);
    setDraft("");
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return <form onSubmit={submit} aria-label={t("chat.compose.form", "Write a message")} style={{ display: "flex", alignItems: "flex-end", gap: 8, padding: "10px 12px calc(10px + env(safe-area-inset-bottom))", borderBlockStart: "1px solid var(--line)", background: "var(--cream)" }}>
    <label style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }} htmlFor="shared-chat-composer">{t("chat.compose.label", "Write a message")}</label>
    <textarea id="shared-chat-composer" value={draft} maxLength={maxLength} rows={1} placeholder={t("chat.compose.placeholder", "Write a message…")} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} disabled={disabled || sending} style={{ flex: 1, minWidth: 0, minHeight: 48, maxHeight: 132, resize: "vertical", border: "1.5px solid var(--line)", borderRadius: 22, padding: "11px 14px", background: "var(--card)", color: "var(--text)" }} />
    <button type="submit" disabled={!canSend} style={{ minWidth: 58, minHeight: 48, paddingInline: 14, borderRadius: 99, background: "var(--ink)", color: "var(--cream)", fontWeight: 700, opacity: canSend ? 1 : 0.55 }} aria-label={t("chat.send.button", "Send")}>
      {sending ? t("chat.send.sending", "Sending") : t("chat.send.button", "Send")}
    </button>
  </form>;
}
