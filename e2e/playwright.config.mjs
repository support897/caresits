import { CARESITTERS_URL } from "./lib.mjs";

export default {
  testDir: "./specs",
  testMatch: "**/*.spec.mjs",
  outputDir: "./test-results",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 90_000,
  reporter: "list",
  use: {
    baseURL: CARESITTERS_URL,
    browserName: "chromium",
    headless: true,
    viewport: { width: 390, height: 844 },
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
};
