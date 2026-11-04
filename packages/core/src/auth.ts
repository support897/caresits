import * as A from "firebase/auth";
import { app, emulatorEnabled } from "./firebase";
import { restoreSessionMirror, startMirror, hasSavedSession } from "./session";
let _auth: A.Auth | null = null;
let _emulatorAuth: A.Auth | null = null;
export function auth(): A.Auth {
  if (_auth) return _auth;
  try { _auth = A.initializeAuth(app, { persistence: [A.browserLocalPersistence, A.indexedDBLocalPersistence] }); } catch { _auth = A.getAuth(app); }
  if (emulatorEnabled && _emulatorAuth !== _auth) {
    A.connectAuthEmulator(_auth, "http://127.0.0.1:9099", { disableWarnings: true });
    _emulatorAuth = _auth;
  }
  try { startMirror(); } catch { /* bonus */ }
  return _auth;
}
export async function waitForSession(): Promise<A.User | null> {
  await restoreSessionMirror(); const a = auth(); const ms = hasSavedSession() ? 9000 : 3000;
  try { await Promise.race([a.authStateReady(), new Promise((r) => setTimeout(r, ms))]); } catch { /* judge on what stands */ }
  if (!a.currentUser && hasSavedSession()) await new Promise((r) => setTimeout(r, 1500));
  return a.currentUser;
}
type NativePlugin = { signInWithGoogle(): Promise<{ credential?: { idToken?: string; accessToken?: string } }>; signInWithApple(): Promise<{ credential?: { idToken?: string; nonce?: string } }> };
const isNative = () => { const c = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor; return !!c?.isNativePlatform?.(); };
const plugin = (): NativePlugin | null => isNative() ? ((window as unknown as { Capacitor: { Plugins?: { FirebaseAuthentication?: NativePlugin } } }).Capacitor.Plugins?.FirebaseAuthentication ?? null) : null;
const limit = <T,>(p: Promise<T>, ms = 90000) => Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(Object.assign(new Error("timeout"), { code: "auth/timeout" })), ms))]);
export async function signInGoogle() { const pl = plugin(); if (pl) { const c = (await limit(pl.signInWithGoogle())).credential; if (!c?.idToken) throw new Error("no credential"); return A.signInWithCredential(auth(), A.GoogleAuthProvider.credential(c.idToken, c.accessToken)); } if (isNative()) throw new Error("native sign in unavailable"); return A.signInWithPopup(auth(), new A.GoogleAuthProvider()); }
export async function signInApple() { const pl = plugin(), prov = new A.OAuthProvider("apple.com"); if (pl) { const c = (await limit(pl.signInWithApple())).credential; if (!c?.idToken) throw new Error("no credential"); return A.signInWithCredential(auth(), prov.credential({ idToken: c.idToken, rawNonce: c.nonce })); } if (isNative()) throw new Error("native sign in unavailable"); return A.signInWithPopup(auth(), prov); }
export async function signInEmail(email: string, password: string) { try { return await A.signInWithEmailAndPassword(auth(), email, password); } catch (e) { const c = (e as { code?: string }).code ?? ""; if (/user-not-found|invalid-credential/.test(c)) return A.createUserWithEmailAndPassword(auth(), email, password); throw e; } }
export const sendReset = (email: string) => A.sendPasswordResetEmail(auth(), email);
export const signOutUser = () => A.signOut(auth());
export const onUser = (cb: (u: A.User | null) => void) => A.onAuthStateChanged(auth(), cb);
export type { User } from "firebase/auth";
