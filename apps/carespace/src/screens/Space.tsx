import "../lib/i18n";
import { useEffect, useState } from "react";
import { BackBar, Empty, t, type ScreenProps, useAuth, useNav } from "@cc/core";
import { getSpaceAccess, type SpaceAccess } from "../data/spaces";
import { loadChildren, type ChildProfile } from "../data/children";
import { ChatPanel, PhotoGallery, TodayTimeline } from "./today/index";

type SpaceParams = { spaceId: string; section?: string };
type SpaceSection = "updates" | "chat" | "photos" | "children";
const SPACE_SECTIONS: Array<[SpaceSection | "calendar" | "requests", string, string]> = [
  ["chat", "cs.space.chat", "Chat"], ["updates", "cs.space.updates", "Updates"],
  ["photos", "cs.space.photos", "Photos"], ["children", "cs.space.children", "Children"],
  ["calendar", "cs.space.calendar", "Calendar"], ["requests", "cs.space.requests", "Requests"],
];

export default function Screen({ params }: ScreenProps<SpaceParams>) {
  const nav = useNav();
  const { user } = useAuth();
  const [section, setSection] = useState<SpaceSection>(params.section === "chat" || params.section === "photos" || params.section === "children" ? params.section : "updates");
  const [access, setAccess] = useState<SpaceAccess | null>(null);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!user?.uid || !params.spaceId) { setLoading(false); return; }
    void Promise.all([getSpaceAccess(user.uid, params.spaceId), loadChildren(params.spaceId).catch(() => [])])
      .then(([value, rows]) => {
        if (alive) { setAccess(value); setChildren(rows); }
      }).catch(() => {
        if (alive) { setAccess(null); setChildren([]); }
      }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [params.spaceId, user?.uid]);

  return <div className="app">
    <BackBar title={access?.space.name ?? t("cs.space.title", "Care Space")} onBack={nav.back} right={<span className="tag" style={{ fontSize: 17 }}>{t("cs.space.private", "Private")}</span>} />
    <nav aria-label={t("cs.space.tools", "Care Space sections")} className="row" style={{ padding: "0 16px 10px", gap: 8 }}>
      {SPACE_SECTIONS.map(([key, labelKey, fallback]) => <button key={key} type="button" className={`chip${section === key ? " on" : ""}`} aria-current={section === key ? "page" : undefined}
        onClick={() => key === "calendar"
          ? user?.uid && nav.push("calendar-space", { uid: user.uid, spaceId: params.spaceId })
          : key === "requests"
            ? user?.uid && nav.push("timeoff", { uid: user.uid, spaceId: params.spaceId })
            : setSection(key)}>{t(labelKey, fallback)}</button>)}
    </nav>
    <div className="screen">
      {loading ? <div className="scroll"><div className="sk" style={{ height: 160 }} /></div>
        : !access || !user?.uid ? <div className="scroll"><Empty mood="oops" title={t("cs.space.unavailable.title", "This space is not available")} body={t("cs.space.unavailable.body", "Ask a family admin to check your access.")} /></div>
        : section === "updates" ? <TodayTimeline spaceId={params.spaceId} uid={user.uid} member={access.member} />
          : section === "photos" ? <PhotoGallery spaceId={params.spaceId} member={access.member} childProfiles={children} />
            : section === "children" ? <div className="scroll">
              <h1 style={{ fontSize: 28, marginBottom: 12 }}>{t("cs.space.children", "Children")}</h1>
              {children.length ? <div style={{ display: "grid", gap: 10 }}>
                {children.map((child) => <button key={child.id} type="button" className="card" aria-label={t("cs.space.child.label", "{name} profile and memories", { name: child.name })}
                  onClick={() => nav.push("child", { spaceId: params.spaceId, childId: child.id, childName: child.name, uid: user.uid, role: access.member.role, perms: access.member.perms, ownerUid: access.space.ownerUid })}
                  style={{ minHeight: 56, display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "start", gap: 12 }}>
                  <span><strong>{child.name}</strong><span className="muted" style={{ display: "block", marginTop: 2 }}>{t("cs.space.child.age", "Age {age} years", { age: child.ageYears })}</span></span>
                  <span aria-hidden="true" className="flip">›</span>
                </button>)}
              </div> : <Empty mood="point" title={t("cs.space.children.empty.title", "Add a child profile")} body={t("cs.space.children.empty.body", "Child profiles keep each child’s care notes separate.")} />}
            </div>
              : <div className="app">
                <div className="row" style={{ justifyContent: "flex-end", padding: "8px 12px 0" }}>
                  <button type="button" className="chip" onClick={() => nav.push("thread", { spaceId: params.spaceId })}>{t("cs.space.fullChat", "Open full chat")}</button>
                </div>
                <div className="screen"><ChatPanel spaceId={params.spaceId} uid={user.uid} member={access.member} /></div>
              </div>}
    </div>
  </div>;
}
