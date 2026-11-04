# Firestore rules

This package keeps a copy of the live rules as the starting point, then adds tests for the v2 CareSpace and booking rules. The proposed rules are not deployed.

Run the emulator suite from this folder:

```sh
pnpm install
pnpm test
```

The test command uses Firebase's Firestore emulator on port `8085` and the `demo-cc` project. Java 21 is required. Tests use `@firebase/rules-unit-testing` and include the 19 existing baseline cases plus new security cases.

Photos and video use the Cloudflare R2 gatekeeper. Firebase Storage is deny-all here. See `../../docs/DATA-MODEL.md` for permitted R2 key shapes. Do not deploy these rules; the owner must review and deploy them.
