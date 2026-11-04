import { useCallback, useEffect, useState } from "react";
import { loadProfile, type Person } from "@cc/core";
export function useMyProfile(uid?: string) {
  const [s, set] = useState<{ profile: Person | null; loading: boolean }>({ profile: null, loading: !!uid });
  const reload = useCallback(async () => { if (!uid) return set({ profile: null, loading: false }); set((x) => ({ ...x, loading: true })); try { set({ profile: await loadProfile(uid), loading: false }); } catch { set({ profile: null, loading: false }); } }, [uid]);
  useEffect(() => { void reload(); }, [reload]);
  return { ...s, reload };
}
