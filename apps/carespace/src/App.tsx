import { useState, useEffect, lazy, Suspense } from "react";
import { useAuth, NavHost, ToastHost, TabBar, SignIn, ICON, useLang, t, APP2, type Registry } from "@cc/core";
const Chats = lazy(() => import("./screens/Chats")); const CalendarTab = lazy(() => import("./screens/Calendar")); const Care = lazy(() => import("./screens/Care")); const Activities = lazy(() => import("./screens/Activities")); const ProfileTab = lazy(() => import("./screens/Profile")); const Welcome = lazy(() => import("./screens/Welcome"));
// Pushed screens (default export, props { params }). The Space home ("Today") opens from a Chats row.
const registry: Registry = {
  space: () => import("./screens/Space"), today: () => import("./screens/Today"), thread: () => import("./screens/Thread"), child: () => import("./screens/Child"), "daily-report": () => import("./screens/DailyReport"),
  team: () => import("./screens/Team"), invite: () => import("./screens/Invite"), join: () => import("./screens/JoinScreen"), medical: () => import("./screens/Medical"), shopping: () => import("./screens/Shopping"), meals: () => import("./screens/Meals"), activity: () => import("./screens/ActivityDetail"),
  timeoff: () => import("./screens/TimeOff"), "event-edit": () => import("./screens/EventEdit"), notifications: () => import("./screens/Notifications"), privacy: () => import("./screens/PrivacyPerms"), emergency: () => import("./screens/EmergencySheet"),
};
const Skel = () => <div className="scroll"><div className="sk" style={{ height: 160 }} /></div>;
export function App() {
  useLang(); const { user, ready } = useAuth(); const [tab, setTab] = useState("chats"); const [seen, setSeen] = useState(() => localStorage.getItem("caresits-cs-welcome") === "1");
  useEffect(() => { document.body.dataset.theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; }, []);
  let body;
  if (!ready) body = <Skel />;
  else if (!user) body = <div className="app"><SignIn title={APP2} tagline={t("cs.tagline", "Run the care day.")} /></div>;
  else {
    const tabs = [{ key: "chats", label: t("cs.tab.chats", "Chats"), icon: ICON.chat }, { key: "calendar", label: t("cs.tab.calendar", "Calendar"), icon: ICON.cal }, { key: "care", label: t("cs.tab.care", "Care"), icon: ICON.care }, { key: "activities", label: t("cs.tab.activities", "Activities"), icon: ICON.sun }, { key: "profile", label: t("cs.tab.profile", "Profile"), icon: ICON.user }];
    body = <NavHost registry={registry}><div className="app"><div className="screen"><Suspense fallback={<Skel />}>
      {!seen && <Welcome params={{ onDone: () => { localStorage.setItem("caresits-cs-welcome", "1"); setSeen(true); } }} />}
      {tab === "chats" && <Chats params={{ uid: user.uid, name: user.displayName ?? "" }} />}{tab === "calendar" && <CalendarTab params={{ uid: user.uid }} />}{tab === "care" && <Care params={{ uid: user.uid }} />}{tab === "activities" && <Activities params={{ uid: user.uid }} />}{tab === "profile" && <ProfileTab params={{ uid: user.uid, name: user.displayName ?? "", email: user.email ?? "" }} />}
    </Suspense></div><TabBar tabs={tabs} value={tab} onChange={setTab} /></div></NavHost>;
  }
  return <>{body}<ToastHost /></>;
}
