# End-to-end tests

This harness builds both web apps, starts local Firebase Auth and Firestore emulators, serves the builds on fixed ports, and runs real Chromium tests through the UI.

## Requirements

- Node.js 20 or newer and Corepack.
- Java 21.
- Playwright installed at `/home/user/pw` with Chromium. Set `PLAYWRIGHT_CLI` and `PLAYWRIGHT_PACKAGE` if those files live elsewhere.
- Linux Chromium libraries. On Ubuntu, install them with Playwright's dependency installer.

Example setup:

```sh
apt-get update
apt-get install -y openjdk-21-jre-headless
/home/user/pw/node_modules/.bin/playwright install --with-deps chromium
corepack pnpm install
```

## Run

From `/home/user/cc`:

```sh
corepack pnpm e2e
```

The script builds both apps, starts `npx --yes firebase-tools emulators:start`, then launches previews at `http://127.0.0.1:4173` and `http://127.0.0.1:4174`. The smoke test opts in with `?emu=1`. Firebase Auth runs at `127.0.0.1:9099`; Firestore runs at `127.0.0.1:8080`.

The emulator config is derived from `packages/rules/firebase.json` and uses its `firestore.rules` path. The checked-in config currently uses Firestore port 8085, so the harness writes a temporary config with the required E2E ports. It does not edit the checked-in Firebase config or rules.

The script stops all servers when the test run ends. It needs the fixed ports to be free.

## Helpers for new specs

Import shared helpers from `e2e/lib.mjs`:

```js
import { createUser, seedProfile, seedCarer, signIn, createSecondUserContext } from "../lib.mjs";
```

- `createUser(email)` creates a disposable user through the Auth Emulator REST API and returns its email, password, UID, and tokens.
- `seedProfile(uid, overrides)` writes an emulator-only profile with Firestore REST's `Bearer owner` bypass.
- `seedCarer(uid, overrides)` writes a carer and a server-owned `verified/{uid}` fixture through the same emulator-only admin path.
- `signIn(page, userOrEmail, password, { side })` uses the app's real email form. New accounts are created by that UI flow.
- `createSecondUserContext(browser, options)` creates a second, separate browser context and signs in a second user through the UI.
- `readDocument`, `writeDocument`, and `resetEmulators` support other emulator tests.

The `seedCarer` verification record is synthetic test data. It exists only in the local emulator, never in a production project. Do not use fixture records as evidence of a real check.

## Add tests

Put new specs in `e2e/specs/<area>.spec.mjs`. The runner loads Playwright from `/home/user/pw`; override `PLAYWRIGHT_PACKAGE` and `PLAYWRIGHT_CLI` if needed. Use emulator helpers only with the local emulator URLs. Never point `resetEmulators`, `seedProfile`, or `seedCarer` at a live project.
