export type TimelineAsk = {
  by: string;
  text: string;
  at: string;
  answeredAt?: string;
  answerText?: string;
  answerPhotoKey?: string;
};

export type TimelineItem = {
  id: string;
  day: string;
  kind: "arrival" | "meal" | "drink" | "nap" | "activity" | "mood" | "photo" | "pickup" | "note";
  at: string | number;
  text: string;
  childId?: string;
  by?: string;
  photoKey?: string;
  mood?: string;
  asks?: TimelineAsk[];
  [key: string]: unknown;
};

export type TimelineDay<T extends TimelineItem = TimelineItem> = { day: string; items: T[] };

function timestamp(value: string | number): number {
  const result = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(result) ? result : 0;
}

export function groupTimelineByDay<T extends TimelineItem>(items: readonly T[]): TimelineDay<T>[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const day = item.day || new Date(timestamp(item.at)).toISOString().slice(0, 10);
    const group = groups.get(day) ?? [];
    group.push(item);
    groups.set(day, group);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([day, entries]) => ({
      day,
      items: entries.sort((left, right) => timestamp(left.at) - timestamp(right.at)),
    }));
}

export function attachAskToItem<T extends TimelineItem>(item: T, ask: TimelineAsk): T {
  return { ...item, asks: [...(item.asks ?? []), { ...ask }] };
}

export function answerAskOnItem<T extends TimelineItem>(
  item: T,
  askIndex: number,
  response: { answeredAt: string; answerText?: string; answerPhotoKey?: string },
): T {
  const asks = [...(item.asks ?? [])];
  const ask = asks[askIndex];
  if (!ask) throw new RangeError("The update request is no longer available.");
  asks[askIndex] = {
    ...ask,
    ...response,
  };
  return { ...item, asks };
}
