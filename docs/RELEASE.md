# Release steps

## Current state

The workspace builds the two web apps. The Capacitor TypeScript configs are ready, but this checkout has no `android/` or `ios/` project and no local Capacitor CLI or platform packages. Add the Capacitor 8 CLI and platform packages before running native builds. Android scaffolding was not run because its offline prerequisites are missing.

Caresitters stays on the current icon until the owner chooses one of the two new options. The care-day app may use its new house-and-heart icon. The public manifest files are ready; the app `index.html` files are outside this task’s owned files, so the lead must add each `<link rel="manifest">` tag before browser install prompts can use them. Never include signing keys, passwords, Firebase service keys, or App Store Connect private keys in this repository.

## Build and test the web apps

Run from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @cc/caresitters typecheck
pnpm --filter @cc/carespace typecheck
pnpm --filter @cc/caresitters exec vitest run
pnpm --filter @cc/carespace exec vitest run
pnpm --filter @cc/caresitters exec vite build
pnpm --filter @cc/carespace exec vite build
```

GitHub Actions runs these checks, Firebase rules emulator tests, the asset budget check, and phone-size Arabic RTL smoke checks. A real phone, live push, live Firestore, and store upload still need separate checks.

## iOS and TestFlight

### New `apps/*` Capacitor projects

After the Capacitor 8 CLI and iOS package are added to the workspace:

```sh
cd apps/caresitters
npx cap add ios        # first native scaffold only
npx cap sync ios
npx cap open ios
```

Repeat in `apps/carespace`. In Xcode, select the app target, confirm its bundle ID and signing team, add the Associated Domains capability from `docs/LINKING.md`, then choose **Product → Archive**. Export with **App Store Connect** distribution. Confirm the exported app has the correct bundle ID and a new build number before upload.

### Existing Mac shipping loop from the handoff

The existing archive wrappers still point at the older `store-build` trees. They do not build this new `apps/*` workspace until its web output and native projects are migrated into those trees. Do not assume a successful old wrapper proves this workspace was shipped.

The Mac recipe uses a locally installed Xcode and the private App Store Connect key. Keep the `.p8` file on the Mac only. The wrappers archive unsigned, apply the existing ad-hoc entitlement step, then export with automatic App Store signing. The Apple team has no registered devices; do not switch this recipe to a device-signed archive.

**Caresitters** (bundle `com.ilse.caresits`, App Store ID `6823577907`; [TestFlight](https://appstoreconnect.apple.com/apps/6823577907/testflight/ios)):

1. Transfer the approved Caresitters source to the Mac working copy. Keep the current icon until the owner chooses option A or B.
2. Run `cd ~/Apps/caresits/store-build && npx cap sync ios` in the legacy shipping tree.
3. In `ios/App/App.xcodeproj/project.pbxproj`, increment both `CURRENT_PROJECT_VERSION` entries. The latest handoff notes build 151; check App Store Connect and use the next unused number.
4. Run the established archive and export wrapper:

   ```sh
   cd ~/Apps/build
   rm -rf App.xcarchive export
   nohup ./archive.sh >/dev/null 2>&1 &
   ```

5. Wait for `~/Apps/build/export/App.ipa`. Check its bundle ID, build number, and that the expected web assets are inside the IPA.

**CareSpace** (bundle `com.ilse.carespace`, App Store ID `6830173345`; [TestFlight](https://appstoreconnect.apple.com/apps/6830173345/testflight/ios)):

1. Transfer the approved care-day source to the Mac working copy.
2. Run `cd ~/Apps/caresits/store-build-cs && npx cap sync ios` in the legacy shipping tree.
3. Check App Store Connect. The latest handoff notes build 3; use the next unused number.
4. Run the CareSpace archive and export wrapper:

   ```sh
   cd ~/Apps/build
   rm -rf AppCS.xcarchive exportCS
   nohup ./archive-cs.sh >/dev/null 2>&1 &
   ```

5. Wait for `~/Apps/build/exportCS/App.ipa`. Check the bundle ID, build number, and web assets.

**Upload either exported IPA** from the Mac with the local App Store Connect key configured there:

```sh
xcrun altool --upload-app -f /path/to/App.ipa -t ios --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID"
```

Use `App.ipa` from `export/` for Caresitters and `App.ipa` from `exportCS/` for CareSpace. Set `ASC_KEY_ID` and `ASC_ISSUER_ID` in the Mac shell from the local App Store Connect key details; the matching `.p8` file stays in the Mac’s private-key folder. Wait for Apple processing. Open the matching [Caresitters TestFlight page](https://appstoreconnect.apple.com/apps/6823577907/testflight/ios) or [CareSpace TestFlight page](https://appstoreconnect.apple.com/apps/6830173345/testflight/ios), add the processed build to the intended tester group, and confirm it appears for testers. Never submit these builds to App Review as part of this test loop.

## Android and Google Play

Run these steps on the Mac or Linux build machine after the Capacitor 8 CLI and Android package are installed. Do this once for each app:

```sh
cd apps/caresitters
npx cap add android        # first scaffold only
npx cap sync android
```

Then repeat in `apps/carespace`. Confirm the generated Android application IDs are `com.ilse.caresits` and `com.ilse.carespace`.

1. Install Android Studio and Java 21. Open the app’s `android/` project and let Gradle sync.
2. Create one protected upload keystore per app. Keep each keystore and its passwords outside the repository. Back up each keystore safely; losing it can block updates.
3. In Android Studio, choose **Build → Generate Signed Bundle / APK → Android App Bundle**. Select that app’s upload key, choose the release variant, then build the `.aab` bundle. Do not commit `key.properties`, signing credentials, or keystores.
4. For a repeatable command-line build after signing is configured, run:

   ```sh
   cd apps/caresitters/android
   ./gradlew bundleRelease
   ```

   The bundle is normally at `app/build/outputs/bundle/release/app-release.aab`. Repeat for the care-day project.
5. In Google Play Console, create or open the matching app by package ID. Use **Testing → Internal testing → Create new release**, upload its `.aab`, review warnings, save, and add the intended testers. Test the install and update path before any production rollout.
6. Copy each Play App Signing SHA-256 fingerprint into that app’s `assetlinks.json` TODO entry, publish the file, and test App Links on a device. Do not ship with placeholder fingerprints.

## Per-app checks before release

- Confirm bundle/package ID, display name, app icon, version, and build number for the correct app.
- Confirm the association files and both universal-link directions using `docs/LINKING.md`.
- Register and test push separately for each app. Confirm notification settings do not cross between apps.
- With airplane mode on, open saved Today and Calendar data. Create a permitted update, restore the network, then confirm the queued write syncs once. Mark real-device and real-Firestore results honestly; emulator passes do not prove them.
- Verify the required privacy disclosures, family-safety rules, store listing, and owner-approved logo before a public release.
