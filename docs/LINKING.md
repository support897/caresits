# App links

## Routes and fallbacks

Both apps use `https://caresits.xyz` as the verified-link domain.

- Caresitters opens the care-day app at `https://caresits.xyz/carespace/<path>`.
- The care-day app opens Caresitters at `https://caresits.xyz/caresitters/<path>`.
- If the other app does not open after 1.2 seconds, the helper sends the user to its App Store page.
- Caresitters App Store ID: `6823577907`.
- CareSpace App Store ID: `6830173345`.

`apps/caresitters/src/lib/crosslink.ts` and `apps/carespace/src/lib/crosslink.ts` each export `openOtherApp(path: string)`. Pass a route path without a leading slash. Each path segment is URL-encoded. The helper tries the HTTPS universal link first, watches for the app hand-off, then uses the matching App Store URL if the page stays open.

Use the Caresitters helper for the permanent message button, accepted-booking hand-off, and “Already working together?” links. Keep these links calm and optional. Do not add repeated pop-ups.

## Files the web host must serve

Each app has matching association files in `public/` and `public/.well-known/`:

- `apple-app-site-association` for Apple.
- `assetlinks.json` for Android.

Serve these exact URLs with HTTPS and no redirect:

- `https://caresits.xyz/.well-known/apple-app-site-association`
- `https://caresits.xyz/.well-known/assetlinks.json`

The Apple file must use `application/json` and have no `.json` suffix. The Android file must use `application/json`. The Apple file lists both `GZ9Z6BPTFR.com.ilse.caresits` and `GZ9Z6BPTFR.com.ilse.carespace`. The Android file lists both package IDs. Its SHA-256 values are TODO placeholders. Replace them with the actual release-signing fingerprints before publishing.

Check the hosted files before installing a test build:

```sh
curl -i https://caresits.xyz/.well-known/apple-app-site-association
curl -i https://caresits.xyz/.well-known/assetlinks.json
```

Do not publish a link setup with the fingerprint placeholders still in place.

## Exact Apple and Xcode setup

Do these steps for both apps. Keep the bundle IDs exact:

1. Sign in to Apple Developer at `https://developer.apple.com/account/`.
2. Open **Certificates, Identifiers & Profiles** → **Identifiers**.
3. Open `com.ilse.caresits`. Enable **Associated Domains** and save.
4. Open `com.ilse.carespace`. Enable **Associated Domains** and save.
5. Open the Caresitters Xcode project. Select the **App** target → **Signing & Capabilities** → **+ Capability** → **Associated Domains**.
6. Add exactly `applinks:caresits.xyz` (no `https://`, slash, or path).
7. Repeat step 5–6 for the care-day app target.
8. Confirm each target’s `.entitlements` file contains `com.apple.developer.associated-domains` with `applinks:caresits.xyz`.
9. Refresh or regenerate the provisioning profiles after enabling the capability. Keep automatic signing on for the App Store export recipe.
10. Build and install both apps on a real iPhone. Tap a Caresitters message link from Notes or Messages. Confirm it opens the care-day app. Remove the care-day app and tap again; confirm the App Store page opens. Repeat in the opposite direction.

Apple caches association data. Host the final file before installing the test build. A link typed into Safari’s address bar is not a useful app-open test; tap a real HTTPS link.

## Android setup

When the native Android projects exist, add App Links intent filters for `/caresitters` and `/caresitters/*` to `com.ilse.caresits`, and `/carespace` and `/carespace/*` to `com.ilse.carespace`. Serve `assetlinks.json` at the URL above. Replace each TODO fingerprint with that app’s Play App Signing SHA-256 fingerprint. Add the upload-key fingerprint too only if that key is used to test installed builds.

Verify both apps from a real Android device after uploading the signed bundle. Placeholder fingerprints do not verify an Android App Link.

## Push and offline behavior

Keep push registration separate for each app and platform app ID. Do not share one app’s notification token or notification settings with the other app. The release check must test a push in each app.

CareSpace has offline-read and queued-write logic for Today and Calendar. Test with airplane mode: open cached Today and Calendar data, make a permitted update, restore the network, and confirm the queued write syncs once. Emulator tests do not prove real-device push delivery or real Firestore sync.
