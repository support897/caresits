// Feature flags: Firebase Remote Config when available, local defaults otherwise. Every new feature sits behind one.
import { app } from "./firebase";
export const DEFAULT_FLAGS = { auPair: true, recurring: true, aiAssist: true, bunnyGuide: true, mealPlanning: true, videoIntro: true } as const;
export type Flag = keyof typeof DEFAULT_FLAGS;
let live: Partial<Record<Flag, boolean>> = {};
export const flag = (f: Flag): boolean => live[f] ?? DEFAULT_FLAGS[f];
export async function loadFlags(): Promise<void> {
  try { const { getRemoteConfig, fetchAndActivate, getValue } = await import("firebase/remote-config"); const rc = getRemoteConfig(app); rc.settings.minimumFetchIntervalMillis = 3600000; rc.defaultConfig = { ...DEFAULT_FLAGS };
    await fetchAndActivate(rc); for (const k of Object.keys(DEFAULT_FLAGS) as Flag[]) live[k] = getValue(rc, k).asBoolean(); } catch { live = {}; }
}
