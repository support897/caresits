import base from "./playwright.config.mjs";
export default { ...base, testDir: "./live", outputDir: "./test-results-live", timeout: 1500_000 };
