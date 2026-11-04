import { DEMO_CHILDREN } from "../../data/children";
import type { CalendarEvent } from "../../data/calendar";
import type { SpaceMember } from "../../data/spaces";
import type { SpaceMessage } from "../../data/chatSpace";
import type { TimelineItem } from "../../lib/timeline";
import type { TodayPreviewData } from "./TodayTimeline";

const now = Date.now();
const stamp = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();
const today = (() => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
})();

export const visualMember: SpaceMember = {
  role: "admin",
  status: "active",
  perms: { allergies: true, medication: true, photos: true, calendar: true, privateMessages: true },
};

export const visualToday: TodayPreviewData = {
  children: DEMO_CHILDREN.slice(0, 1).map(({ id, name, ageYears }) => ({ id, name, ageYears })),
  events: [{
    id: "demo-pickup",
    title: "Library pickup",
    kind: "pickup",
    start: new Date(now + 45 * 60_000).toISOString(),
    end: new Date(now + 60 * 60_000).toISOString(),
    ownerUid: "demo-parent",
    state: "active",
  }],
  items: [
    { id: "demo-arrival", childId: "demo-mila", day: today, kind: "arrival", at: stamp(210), text: "Mila arrived in a bright mood.", by: "demo-carer" },
    { id: "demo-meal", childId: "demo-mila", day: today, kind: "meal", at: stamp(165), text: "Oatmeal, banana and a little yogurt.", by: "demo-carer" },
    { id: "demo-drink", childId: "demo-mila", day: today, kind: "drink", at: stamp(130), text: "Finished her water bottle.", by: "demo-carer" },
    { id: "demo-nap", childId: "demo-mila", day: today, kind: "nap", at: stamp(75), text: "Rested from 12:30 to 1:15.", by: "demo-carer" },
    { id: "demo-painting", childId: "demo-mila", day: today, kind: "activity", at: stamp(30), text: "Painted a garden of tiny flowers.", by: "demo-carer", asks: [{ by: "demo-parent", text: "Please send a photo of the painting.", at: stamp(24), answeredAt: stamp(6), answerText: "Here is the finished garden." }] },
  ] as TimelineItem[],
};

export const visualMessages: SpaceMessage[] = [
  { id: "demo-msg-1", from: "demo-parent", text: "Could you send me an update after lunch?", at: stamp(55), kind: "text" },
  { id: "demo-msg-2", from: "demo-carer", text: "Of course. Mila had oatmeal and banana, then rested well.", at: stamp(42), kind: "text" },
  { id: "demo-msg-3", from: "demo-parent", text: "Thank you. I love seeing her little garden.", at: stamp(18), kind: "text" },
];

export const visualCalendarEvent: CalendarEvent = {
  id: "demo-shift",
  title: "Morning care",
  kind: "shift",
  start: stamp(240),
  end: stamp(180),
  ownerUid: "demo-parent",
  state: "active",
  spaceId: "demo-johnson",
  spaceName: "Johnson family",
};
