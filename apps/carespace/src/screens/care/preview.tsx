import { createRoot } from "react-dom/client";
import type { ComponentType } from "react";
import Care from "../Care";
import Child from "../Child";
import DailyReport from "../DailyReport";
import Medical from "../Medical";
import EmergencySheet from "../EmergencySheet";
import Activities from "../Activities";
import ActivityDetail from "../ActivityDetail";
import Shopping from "../Shopping";
import Meals from "../Meals";

const query = new URLSearchParams(window.location.search);
const key = query.get("screen") ?? "Child";
const demo = true;
const perms = { allergies: true, medication: true, photos: true, calendar: true, privateMessages: true };
const params: Record<string, unknown> = {
  uid: "demo-parent", spaceId: "demo-johnson", childId: "demo-mila", childName: "Mila", ownerUid: "demo-parent", role: "admin", perms, demo,
  activityId: query.get("activity") ?? "float-and-sink",
};
const screens: Record<string, ComponentType<{ params: Record<string, unknown> }>> = {
  Care: Care as ComponentType<{ params: Record<string, unknown> }>,
  Child: Child as ComponentType<{ params: Record<string, unknown> }>,
  DailyReport: DailyReport as ComponentType<{ params: Record<string, unknown> }>,
  Medical: Medical as ComponentType<{ params: Record<string, unknown> }>,
  EmergencySheet: EmergencySheet as ComponentType<{ params: Record<string, unknown> }>,
  Activities: Activities as ComponentType<{ params: Record<string, unknown> }>,
  ActivityDetail: ActivityDetail as ComponentType<{ params: Record<string, unknown> }>,
  Shopping: Shopping as ComponentType<{ params: Record<string, unknown> }>,
  Meals: Meals as ComponentType<{ params: Record<string, unknown> }>,
};
const Screen = screens[key] ?? Child;
createRoot(document.getElementById("root")!).render(<div className="app"><div className="screen"><Screen params={params} /></div></div>);
