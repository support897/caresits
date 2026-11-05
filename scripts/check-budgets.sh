#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
total=$(( $(wc -c < packages/core/src/Bunny.tsx) + $(wc -c < packages/core/src/bunny.css) ))
if (( total > 61440 )); then printf 'Bunny source exceeds 60 KiB: %s bytes\n' "$total" >&2; exit 1; fi
if ls packages/core/src/assets/bunny/*.png >/dev/null 2>&1; then echo 'Bunny must be vector, found PNG' >&2; exit 1; fi
printf 'Bunny is vector and %s bytes (limit 61440).\n' "$total"
