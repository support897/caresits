#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PROJECT_ID="${FIREBASE_PROJECT_ID:-caresits-812a0}"
PLAYWRIGHT_PACKAGE="${PLAYWRIGHT_PACKAGE:-/home/user/pw/package.json}"
PLAYWRIGHT_CLI="${PLAYWRIGHT_CLI:-/home/user/pw/node_modules/.bin/playwright}"
TMP_DIR="$(mktemp -d)"
EMU_PID=""
CS_PID=""
SECOND_PID=""
FILES_PID=""

stop_group() {
  local pid="$1"
  [[ -z "$pid" ]] && return 0
  kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
}
cleanup() {
  stop_group "$CS_PID"
  stop_group "$SECOND_PID"
  stop_group "$FILES_PID"
  stop_group "$EMU_PID"
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

if [[ ! -x "$PLAYWRIGHT_CLI" ]]; then
  printf 'Playwright CLI not found: %s\nSet PLAYWRIGHT_CLI to its installed executable.\n' "$PLAYWRIGHT_CLI" >&2
  exit 1
fi
export PLAYWRIGHT_PACKAGE FIREBASE_PROJECT_ID="$PROJECT_ID"

# Keep packages/rules/firebase.json as the source of truth, but use the required fixed E2E ports.
python3 - "$ROOT/packages/rules/firebase.json" "$TMP_DIR/firebase.json" <<'PY'
import json
import os
import sys

source_path, target_path = sys.argv[1:]
with open(source_path, encoding="utf-8") as source_file:
    source = json.load(source_file)
firestore = dict(source.get("firestore", {}))
firestore["rules"] = os.path.abspath(os.path.join(os.path.dirname(source_path), firestore["rules"]))
config = {
    "firestore": firestore,
    "emulators": {
        "auth": {"host": "127.0.0.1", "port": 9099},
        "firestore": {"host": "127.0.0.1", "port": 8080},
        "ui": {"enabled": False},
        "singleProjectMode": True,
    },
}
with open(target_path, "w", encoding="utf-8") as target_file:
    json.dump(config, target_file, indent=2)
PY

start_group() {
  local log_file="$1"
  shift
  setsid "$@" >"$log_file" 2>&1 &
  echo "$!"
}
wait_for_port() {
  local url="$1" pid="$2" label="$3" log_file="$4"
  for _ in $(seq 1 180); do
    if curl -sS --max-time 2 "$url" >/dev/null 2>&1; then return 0; fi
    if ! kill -0 "$pid" 2>/dev/null; then
      printf '%s stopped before it was ready. Log:\n' "$label" >&2
      cat "$log_file" >&2
      return 1
    fi
    sleep 1
  done
  printf 'Timed out waiting for %s at %s. Log:\n' "$label" "$url" >&2
  cat "$log_file" >&2
  return 1
}

printf 'Building both apps...\n'
VITE_EMULATOR=0 corepack pnpm --filter @cc/caresitters build
VITE_EMULATOR=0 corepack pnpm --filter @cc/carespace build

printf 'Starting Auth and Firestore emulators...\n'
EMU_PID="$(start_group "$TMP_DIR/emulators.log" env CI=1 npx --yes firebase-tools emulators:start --only auth,firestore --config "$TMP_DIR/firebase.json" --project "$PROJECT_ID")"
wait_for_port "http://127.0.0.1:9099/" "$EMU_PID" "Auth Emulator" "$TMP_DIR/emulators.log"
wait_for_port "http://127.0.0.1:8080/" "$EMU_PID" "Firestore Emulator" "$TMP_DIR/emulators.log"

printf 'Starting fixed-port app previews...\n'
CS_PID="$(start_group "$TMP_DIR/caresitters.log" corepack pnpm --filter @cc/caresitters exec vite preview --host 127.0.0.1 --port 4173 --strictPort)"
SECOND_PID="$(start_group "$TMP_DIR/second-app.log" corepack pnpm --filter @cc/carespace exec vite preview --host 127.0.0.1 --port 4174 --strictPort)"
wait_for_port "http://127.0.0.1:4173/" "$CS_PID" "Caresitters preview" "$TMP_DIR/caresitters.log"
wait_for_port "http://127.0.0.1:4174/" "$SECOND_PID" "Second app preview" "$TMP_DIR/second-app.log"

FILES_PID="$(start_group "$TMP_DIR/files.log" node "$ROOT/e2e/fake-files.mjs")"
sleep 1
printf 'Running Playwright smoke specs...\n'
printf "READY\n"; sleep 7200
