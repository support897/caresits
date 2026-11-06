import { emulatorEnabled } from "../firebase";
export const LIVE_MEDIA_URL = "https://caresits-files.placenciailse.workers.dev";
/** In the local emulator (localhost + ?emu=1 only) uploads go to the fake file service started by e2e/fake-files.mjs. */
export const MEDIA_GATEKEEPER_BASE_URL = emulatorEnabled ? "http://127.0.0.1:9199" : LIVE_MEDIA_URL;
export const PRESIGNED_LINK_SECONDS = 300;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 60;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
