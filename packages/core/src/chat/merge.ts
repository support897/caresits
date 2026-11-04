import { t } from "../i18n";

export type MessageKind = "text" | "photo" | "photoAsk";
export type ChatMessage = {
  id?: string;
  from: string;
  kind?: MessageKind;
  text?: string;
  img?: string;
  at?: unknown;
  queued?: boolean;
  pending?: boolean;
};

export type RelationshipRow = {
  id: string;
  familyUid?: string;
  carerUid?: string;
  members?: string[];
  state?: string;
  createdBy?: string;
  createdAt?: unknown;
};
export type ChatFilter = "All" | "Families" | "Carers" | "Unread" | "Requests";

export function timeMs(value: unknown): number {
  if (value == null) return 0;
  try {
    if (typeof value === "object" && value && "toMillis" in value && typeof value.toMillis === "function") return value.toMillis();
    if (typeof value === "object" && value && "toDate" in value && typeof value.toDate === "function") return value.toDate().getTime();
  } catch { return 0; }
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function messageKey(message: ChatMessage): string {
  return message.id
    ? `id:${message.id}`
    : `fallback:${message.from}:${message.kind ?? ""}:${message.text ?? ""}:${message.img ?? ""}:${timeMs(message.at)}`;
}

export function mergeMessageStreams(first: readonly ChatMessage[] = [], second: readonly ChatMessage[] = []): ChatMessage[] {
  const byKey = new Map<string, { message: ChatMessage; sequence: number }>();
  let sequence = 0;
  for (const message of [...first, ...second]) {
    if (!message) continue;
    const key = messageKey(message);
    if (!byKey.has(key)) byKey.set(key, { message, sequence: sequence++ });
  }
  return [...byKey.values()]
    .sort((a, b) => timeMs(a.message.at) - timeMs(b.message.at) || a.sequence - b.sequence)
    .map(({ message }) => message);
}

export function getUnreadCount(messages: readonly ChatMessage[] = [], uid: string, lastSeenAt: unknown = 0): number {
  const seen = timeMs(lastSeenAt);
  return messages.filter((message) => message.from !== uid && timeMs(message.at) > seen).length;
}

const ACTIVE_STATES = new Set(["contact", "hired"]);
function otherSide(rel: RelationshipRow, me: { uid?: string; side?: string }): "family" | "carer" | "" {
  if (rel.familyUid && rel.familyUid !== me.uid) return "family";
  if (rel.carerUid && rel.carerUid !== me.uid) return "carer";
  if (me.side === "family") return "carer";
  if (me.side === "carer") return "family";
  return "";
}

export function filterChatsByTab(
  rels: readonly RelationshipRow[] = [],
  tab: ChatFilter = "All",
  me: { uid?: string; side?: string } = {},
  unreadCounts: Readonly<Record<string, number>> = {},
): RelationshipRow[] {
  const seen = new Set<string>();
  const unique = rels.filter((rel) => {
    const key = rel.id || `${rel.familyUid ?? ""}_${rel.carerUid ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (tab === "Requests") return unique.filter((rel) => rel.state === "pending");
  if (tab === "Unread") return unique.filter((rel) => ACTIVE_STATES.has(rel.state ?? "") && (unreadCounts[rel.id] ?? 0) > 0);
  if (tab === "Families" || tab === "Carers") {
    const wanted = tab === "Families" ? "family" : "carer";
    return unique.filter((rel) => ACTIVE_STATES.has(rel.state ?? "") && otherSide(rel, me) === wanted);
  }
  return unique.filter((rel) => ACTIVE_STATES.has(rel.state ?? ""));
}

export function messagePreview(message?: ChatMessage | null): string {
  if (!message) return t("chat.preview.start", "Start a conversation");
  if (message.text) return message.text;
  if (message.kind === "photo") return t("chat.preview.photo", "Photo");
  if (message.kind === "photoAsk") return t("chat.preview.photoRequest", "Photo update request");
  return t("chat.preview.message", "Message");
}

export function messageCollectionPath(relId: string): string {
  if (!relId || relId.includes("/")) throw new Error("Invalid relationship id");
  return `relationships/${relId}/messages`;
}
