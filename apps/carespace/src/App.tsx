import { useState, useEffect, lazy, Suspense, useRef } from "react";
import { useAuth, useNav, NavHost, ToastHost, TabBar, SignIn, ICON, useLang, t, APP2, type Registry } from "@cc/core";
const Chats = lazy(() => import("./screens/Chats")); const CalendarTab = lazy(() => import("./screens/Calendar")); const Care = lazy(() => import("./screens/Care")); const Activities = lazy(() => import("./screens/Activities")); const ProfileTab = lazy(() => import("./screens/Profile")); const Welcome = lazy(() => import("./screens/Welcome"));
// Pushed screens (default export, props { params }). The Space home ("Today") opens from a Chats row.
const registry: Registry = {
  space: () => import("./screens/Space"), today: () => import("./screens/Today"), thread: () => import("./screens/Thread"), child: () => import("./screens/Child"), "calendar-space": () => import("./screens/Calendar"), "daily-report": () => import("./screens/DailyReport"),
  team: () => import("./screens/Team"), invite: () => import("./screens/Invite"), join: () => import("./screens/JoinScreen"), profile: () => import("./screens/Profile"), medical: () => import("./screens/Medical"), shopping: () => import("./screens/Shopping"), meals: () => import("./screens/Meals"), activity: () => import("./screens/ActivityDetail"),
  timeoff: () => import("./screens/TimeOff"), "event-edit": () => import("./screens/EventEdit"), notifications: () => import("./screens/Notifications"), privacy: () => import("./screens/PrivacyPerms"), emergency: () => import("./screens/EmergencySheet"),
};
const Skel = () => <div className="scroll"><div className="sk" style={{ height: 160 }} /></div>;

function inviteInputFromUrl(): string {
  const url = new URL(window.location.href);
  const fullInvite = url.searchParams.get("invite");
  if (fullInvite) return fullInvite;
  const spaceId = url.searchParams.get("spaceId") ?? url.searchParams.get("space") ?? "";
  const code = url.searchParams.get("code") ?? "";
  return spaceId && code ? `${spaceId}.${code}` : "";
}

type SignedInAppProps = { uid: string; name: string; email: string; seen: boolean; inviteInput: string; onWelcomeDone: () => void };
function SignedInApp({ uid, name, email, seen, inviteInput, onWelcomeDone }: SignedInAppProps) {
  const nav = useNav();
  const [tab, setTab] = useState("chats");
  const lastInvite = useRef("");
  useEffect(() => {
    if (inviteInput && inviteInput !== lastInvite.current) {
      lastInvite.current = inviteInput;
      nav.push("join", { initialInput: inviteInput, onDone: onWelcomeDone });
    }
  }, [inviteInput, nav, onWelcomeDone]);
  const tabs = [{ key: "chats", label: t("cs.tab.chats", "Chats"), icon: ICON.chat }, { key: "calendar", label: t("cs.tab.calendar", "Calendar"), icon: ICON.cal }, { key: "care", label: t("cs.tab.care", "Care"), icon: ICON.care }, { key: "activities", label: t("cs.tab.activities", "Activities"), icon: ICON.sun }, { key: "profile", label: t("cs.tab.profile", "Profile"), icon: ICON.user }];
  return <div className="app"><div className="screen"><Suspense fallback={<Skel />}>
    {!seen && <Welcome params={{ uid, name, onDone: onWelcomeDone }} />}
    {tab === "chats" && <Chats params={{ uid, name }} />}{tab === "calendar" && <CalendarTab params={{ uid }} />}{tab === "care" && <Care params={{ uid }} />}{tab === "activities" && <Activities params={{ uid }} />}{tab === "profile" && <ProfileTab params={{ uid, name, email }} />}
  </Suspense></div><TabBar tabs={tabs} value={tab} onChange={setTab} /></div>;
}

export function App() {
  useLang(); const { user, ready } = useAuth(); const [seen, setSeen] = useState(() => localStorage.getItem("caresits-cs-welcome") === "1");
  const [inviteInput, setInviteInput] = useState(() => inviteInputFromUrl());
  useEffect(() => { document.body.dataset.theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; }, []);
  useEffect(() => {
    const updateInvite = () => setInviteInput(inviteInputFromUrl());
    window.addEventListener("popstate", updateInvite);
    window.addEventListener("hashchange", updateInvite);
    return () => { window.removeEventListener("popstate", updateInvite); window.removeEventListener("hashchange", updateInvite); };
  }, []);
  const onWelcomeDone = () => { localStorage.setItem("caresits-cs-welcome", "1"); setSeen(true); };
  let body;
  if (!ready) body = <Skel />;
  else if (!user) body = <div className="app"><SignIn title={APP2} tagline={t("cs.tagline", "Run the care day.")} /></div>;
  else body = <NavHost registry={registry}><SignedInApp uid={user.uid} name={user.displayName ?? ""} email={user.email ?? ""} seen={seen} inviteInput={inviteInput} onWelcomeDone={onWelcomeDone} /></NavHost>;
  return <>{body}<ToastHost /></>;
}
