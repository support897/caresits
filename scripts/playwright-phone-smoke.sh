#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
TMP_DIR="$(mktemp -d)"
CS_PID=""
SPACE_PID=""
cleanup() {
  if [[ -n "$CS_PID" ]]; then kill "$CS_PID" 2>/dev/null || true; fi
  if [[ -n "$SPACE_PID" ]]; then kill "$SPACE_PID" 2>/dev/null || true; fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

pnpm --filter @cc/caresitters exec vite preview --host 127.0.0.1 --port 4173 --strictPort >"$TMP_DIR/caresitters.log" 2>&1 &
CS_PID=$!
pnpm --filter @cc/carespace exec vite preview --host 127.0.0.1 --port 4174 --strictPort >"$TMP_DIR/carespace.log" 2>&1 &
SPACE_PID=$!

wait_for_server() {
  local url="$1"
  for _ in $(seq 1 40); do
    if curl -fsS "$url" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  printf 'Preview server did not start: %s\n' "$url" >&2
  return 1
}
wait_for_server http://127.0.0.1:4173/
wait_for_server http://127.0.0.1:4174/

npm install --prefix "$TMP_DIR" --no-save --no-audit --no-fund playwright
"$TMP_DIR/node_modules/.bin/playwright" install --with-deps chromium
NODE_PATH="$TMP_DIR/node_modules" node <<'NODE'
const { chromium, devices } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [name, url] of [
      ["Caresitters", "http://127.0.0.1:4173/"],
      ["Care app", "http://127.0.0.1:4174/"],
    ]) {
      for (const width of [390, 320]) {
        const context = await browser.newContext({
          ...devices["iPhone 14"],
          locale: "ar",
          viewport: { width, height: width === 390 ? 844 : 568 },
        });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(1000);
        const state = await page.evaluate(() => ({
          direction: document.documentElement.dir,
          language: document.documentElement.lang,
          viewport: document.documentElement.clientWidth,
          content: document.body.innerText.trim().length,
          scrollWidth: document.documentElement.scrollWidth,
        }));
        if (state.direction !== "rtl") throw new Error(`${name} ${width}px: expected RTL, got ${state.direction}`);
        if (state.content === 0) throw new Error(`${name} ${width}px: page has no visible text`);
        if (state.scrollWidth > state.viewport + 1) throw new Error(`${name} ${width}px: horizontal overflow (${state.scrollWidth}px)`);
        if (errors.length) throw new Error(`${name} ${width}px: ${errors.join("; ")}`);
        console.log(`${name} ${width}px Arabic RTL: ${state.language}, no overflow, no page errors`);
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
NODE
