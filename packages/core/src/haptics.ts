type H = { impact(o: { style: string }): void };
export function haptic(s: "light" | "heavy" = "light") { try { const h = (window as unknown as { Capacitor?: { Plugins?: { Haptics?: H } } }).Capacitor?.Plugins?.Haptics; h?.impact({ style: s === "heavy" ? "HEAVY" : "LIGHT" }); } catch { /* none */ } }
