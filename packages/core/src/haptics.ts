import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

export function haptic(s: "light" | "heavy" = "light"): void {
  try {
    if (!Capacitor.isNativePlatform()) return;
    void Haptics.impact({ style: s === "heavy" ? ImpactStyle.Heavy : ImpactStyle.Light }).catch(() => {});
  } catch { /* unavailable */ }
}
