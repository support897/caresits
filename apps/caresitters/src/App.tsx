import { useState, useEffect, lazy, Suspense } from "react";
import { useAuth, NavHost, ToastHost, TabBar, ICON, useLang, t, type Registry } from "@cc/core";
import { useMyProfile } from "./data/me";
const Welcome = lazy(() => import("./screens/Welcome")); const AuthScreen = lazy(() => import("./screens/Auth")); const Builder = lazy(() => import("./screens/Builder")); const Tour = lazy(() => import("./screens/Tour"));
const Discover = lazy(() => import("./screens/Discover")); const Saved = lazy(() => import("./screens/Saved")); const Bookings = lazy(() => import("./screens/Bookings")); const Messages = lazy(() => import("./screens/Messages")); const Me = lazy(() => import("./screens/Me"));
// Every pushed screen is registered here. Each file has a default export taking { params }.
const registry: Registry = {
  person: () => import("./screens/PersonProfile"), book: () => import("./screens/Book"), accepted: () => import("./screens/Accepted"), handoff: () => import("./screens/Handoff"),
  chat: () => import("./screens/Chat"), aupair: () => import("./screens/aupair/AuPairHome"), "aupair-profile": () => import("./screens/aupair/AuPairProfile"), "aupair-visa": () => import("./screens/aupair/VisaGuide"),
  safety: () => import("./screens/Safety"), quals: () => import("./screens/Quals"), weights: () => import("./screens/Weights"), settings: () => import("./screens/Settings"), "edit-profile": () => import("./screens/Builder"), plans: () => import("./screens/Plans"),
};
const Skel = () => <div className="scroll"><div className="sk" style={{ height: 160 }} /></div>;
export function App() {
  useLang(); const { user, ready } = useAuth(); const { profile, loading, reload } = useMyProfile(user?.uid);
  const [tab, setTab] = useState("discover"); const [tourDone, setTourDone] = useState(() => localStorage.getItem("caresits-tour-done") === "1");
  useEffect(() => { document.body.dataset.theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; }, []);
  let body;
  if (!ready) body = <Skel />;
  else if (!user) body = <Suspense fallback={<Skel />}><WelcomeAuth /></Suspense>;
  else if (loading) body = <Skel />;
  else if (!profile) body = <Suspense fallback={<Skel />}><Builder params={{ onDone: reload }} /></Suspense>;
  else {
    const tabs = [{ key: "discover", label: t("tab.discover", "Discover"), icon: ICON.discover }, { key: "saved", label: t("tab.saved", "Saved"), icon: ICON.heart }, { key: "bookings", label: t("tab.bookings", "Bookings"), icon: ICON.cal }, { key: "messages", label: t("tab.messages", "Messages"), icon: ICON.chat }, { key: "me", label: profile.side === "family" ? t("tab.family", "My family") : t("tab.me", "Me"), icon: ICON.user }];
    body = <NavHost registry={registry}><div className="app">{!tourDone && <Suspense fallback={null}><Tour params={{ onDone: () => { localStorage.setItem("caresits-tour-done", "1"); setTourDone(true); } }} /></Suspense>}
      <div className="screen"><Suspense fallback={<Skel />}>
        {tab === "discover" && <Discover params={{ me: profile }} />}{tab === "saved" && <Saved params={{ me: profile }} />}{tab === "bookings" && <Bookings params={{ me: profile }} />}{tab === "messages" && <Messages params={{ me: profile }} />}{tab === "me" && <Me params={{ me: profile, reload }} />}
      </Suspense></div><TabBar tabs={tabs} value={tab} onChange={setTab} /></div></NavHost>;
  }
  return <>{body}<ToastHost /></>;
}
function WelcomeAuth() { const [side, setSide] = useState<string | null>(() => localStorage.getItem("caresits-side")); return side ? <AuthScreen params={{ side }} /> : <Welcome params={{ onPick: (s: string) => { localStorage.setItem("caresits-side", s); setSide(s); } }} />; }
