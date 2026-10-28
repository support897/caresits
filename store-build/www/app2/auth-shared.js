// One way to make the Auth object for every page of the app.
// The door page names browserLocal storage on iPhone; the main app
// page used plain getAuth (IndexedDB first, which can stall in the
// iPhone webview), so the saved login was not found and the app
// bounced to the door. Every page now builds Auth the same way.
export function isNative() {
  try { const c = window.Capacitor; return !!(c && typeof c.isNativePlatform === "function" && c.isNativePlatform()); }
  catch { return false; }
}
export function sharedAuth(authMod, app) {
  if (isNative() && typeof authMod.initializeAuth === "function" && authMod.browserLocalPersistence) {
    try { return authMod.initializeAuth(app, { persistence: authMod.browserLocalPersistence }); }
    catch { /* already made: use that one */ }
  }
  return authMod.getAuth(app);
}
