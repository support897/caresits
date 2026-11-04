import { useEffect, useState } from "react";
import { onUser, waitForSession, type User } from "./auth";
export function useAuth(): { user: User | null; ready: boolean } {
  const [s, set] = useState<{ user: User | null; ready: boolean }>({ user: null, ready: false });
  useEffect(() => { let off = () => {}; let dead = false; void waitForSession().then((u) => { if (dead) return; set({ user: u, ready: true }); off = onUser((x) => set({ user: x, ready: true })); }); return () => { dead = true; off(); }; }, []);
  return s;
}
