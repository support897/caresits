// All user-facing text goes through t(key, english). Seven languages: en es ar(RTL) hi vi yue zh.
// Translations live in i18n/<lang>.ts as Record<string,string> keyed by the same keys. Missing key => English.
import { useSyncExternalStore } from "react";
export const ALL_LANGS = [["en", "English"], ["es", "Español"], ["ar", "العربية"], ["hi", "हिन्दी"], ["vi", "Tiếng Việt"], ["yue", "廣東話"], ["zh", "中文"]] as const;
export type Lang = (typeof ALL_LANGS)[number][0];
// Only English is switched on for now. Other dictionaries stay in code (i18n/es.ts etc.). To re-enable, add codes here.
export const ENABLED_LANGS: readonly Lang[] = ["en"];
export const LANGS = ALL_LANGS.filter((l) => ENABLED_LANGS.includes(l[0]));
const dict: Partial<Record<Lang, Record<string, string>>> = {};
const KEY = "caresits-lang"; const subs = new Set<() => void>();
export const registerLang = (l: Lang, d: Record<string, string>) => { dict[l] = { ...(dict[l] ?? {}), ...d }; subs.forEach((f) => f()); };
export const getLang = (): Lang => { try { const v = localStorage.getItem(KEY) as Lang | null; if (v && LANGS.some((x) => x[0] === v)) return v; } catch { /* off */ } const n = (typeof navigator !== "undefined" ? navigator.language : "en").toLowerCase(); const c: Lang = n.startsWith("yue") || n === "zh-hk" ? "yue" : (ALL_LANGS.find((x) => n.startsWith(x[0]))?.[0] ?? "en"); return ENABLED_LANGS.includes(c) ? c : "en"; };
export const isRTL = (l: Lang = getLang()) => l === "ar";
export function setLang(l: Lang) { try { localStorage.setItem(KEY, l); } catch { /* off */ } applyDir(); subs.forEach((f) => f()); }
export function applyDir() { if (typeof document === "undefined") return; const l = getLang(); document.documentElement.lang = l === "yue" ? "zh-HK" : l; document.documentElement.dir = isRTL(l) ? "rtl" : "ltr"; }
export function t(key: string, en: string, vars?: Record<string, string | number>): string {
  const l = getLang(); let s = (l === "en" ? undefined : dict[l]?.[key]) ?? en;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v)); return s;
}
export function useLang(): Lang { return useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, getLang, () => "en" as Lang); }
export const allDicts = () => dict;
