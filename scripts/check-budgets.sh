#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

for app in apps/caresitters apps/carespace; do
  matches=0
  for file in "$app"/dist/assets/bunny-*.webp; do
    [[ -f "$file" ]] || continue
    matches=$((matches + 1))
    size="$(wc -c < "$file" | tr -d '[:space:]')"
    if (( size > 61440 )); then
      printf 'Bunny asset exceeds 60 KiB: %s (%s bytes)\n' "$file" "$size" >&2
      exit 1
    fi
  done
  if (( matches == 0 )); then
    printf 'No WebP bunny assets found in %s/dist/assets\n' "$app" >&2
    exit 1
  fi
done
printf '%s\n' 'Bunny WebP assets stay under 60 KiB.'
