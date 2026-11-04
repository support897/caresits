#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CANDIDATES="$(grep -RIlF \
  --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.mjs' \
  --include='*.html' --include='*.css' --include='*.svg' --include='*.json' --include='*.webmanifest' \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.vite --exclude='brand.ts' \
  'CareSpace' apps packages functions 2>/dev/null || true)"

python3 - "$CANDIDATES" <<'PY'
from pathlib import Path
import re
import sys

paths = [Path(p) for p in sys.argv[1].splitlines() if p]
found = []

def is_test_file(path):
    name = path.name.lower()
    return any(part.lower() in {"test", "tests", "__tests__"} for part in path.parts) or bool(re.search(r"(?:^|[.-])(?:test|spec)(?:[.-]|$)|-tests\.", name))

def is_translation_key(value, following):
    return following.lstrip().startswith(":") and bool(re.fullmatch(r"[A-Za-z][\w-]*(?:\.[A-Za-z][\w-]*)+", value))

def is_t_key(text, start):
    prefix = text[max(0, start - 100):start]
    return bool(re.search(r"\bt\(\s*$", prefix))

for path in paths:
    if is_test_file(path):
        continue
    text = path.read_text(encoding="utf-8", errors="replace")
    i = 0
    line = 1
    while i < len(text):
        if text.startswith("//", i):
            end = text.find("\n", i)
            if end < 0:
                break
            line += 1
            i = end + 1
            continue
        if text.startswith("/*", i):
            end = text.find("*/", i + 2)
            if end < 0:
                break
            line += text.count("\n", i, end + 2)
            i = end + 2
            continue
        quote = text[i]
        if quote in ("'", '"', "`"):
            start_line = line
            start = i
            i += 1
            escaped = False
            value = []
            while i < len(text):
                ch = text[i]
                if ch == "\n":
                    line += 1
                if escaped:
                    value.append(ch)
                    escaped = False
                    i += 1
                    continue
                if ch == "\\":
                    escaped = True
                    i += 1
                    continue
                if ch == quote:
                    i += 1
                    break
                value.append(ch)
                i += 1
            rendered = "".join(value)
            following = text[i:i + 40]
            if "CareSpace" in rendered and not is_t_key(text, start) and not is_translation_key(rendered, following):
                source_line = text.splitlines()[start_line - 1].strip()
                found.append(f"{path}:{start_line}: {source_line}")
            continue
        i += 1
        if text[i - 1] == "\n":
            line += 1

# Catch a brand name rendered as raw JSX text, not inside a quoted attribute.
for path in paths:
    if is_test_file(path):
        continue
    for line_number, source_line in enumerate(path.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
        if re.search(r">[^<{}\n]*CareSpace[^<{}\n]*<", source_line):
            found.append(f"{path}:{line_number}: {source_line.strip()}")

if found:
    print("User-visible hard-coded CareSpace strings found outside packages/core/src/brand.ts and docs:")
    print("\n".join(sorted(set(found))))
    sys.exit(1)
print("No user-visible duplicated app-name strings found.")
PY
