import { useEffect, useState } from "react";
import { onUser, waitForSession, type User } from "./auth";
/** Signed-in state. Listens from the first moment, so a sign-in that finishes at any time shows up at once. */
export function useAuth(): { user: User | null; ready: boolean } {
  const [s, set] = useState<{ user: User | null; ready: boolean }>({ user: null, ready: false });
  useEffect(() => {
    let dead = false; let settled = false;
    const off = onUser((x) => { if (dead) return; if (x) { settled = true; set({ user: x, ready: true }); } else if (settled) set({ user: null, ready: true }); });
    void waitForSession().then((u) => { if (dead) return; settled = true; set({ user: u, ready: true }); });
    return () => { dead = true; off(); };
  }, []);
  return s;
}
