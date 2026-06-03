#!/bin/bash
# SessionStart hook — Release Notes app.
#
# This project has no dependency manifest: each app is a single self-contained
# HTML file (markup + CSS + JS inline), so there is nothing to `npm install`.
# The one check that matters is that the inline <script> blocks still parse.
# This hook verifies the toolchain and syntax-checks every Jira_*.html app,
# printing a status line into the session context. It always exits 0 so a
# failing check never blocks the session from starting.
set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$ROOT" || exit 0

# Toolchain we rely on for the syntax check.
command -v node    >/dev/null 2>&1 || { echo "SessionStart: node not found — skipping syntax check."; exit 0; }
command -v python3 >/dev/null 2>&1 || { echo "SessionStart: python3 not found — skipping syntax check."; exit 0; }

shopt -s nullglob
apps=(Jira_*.html)
if [ ${#apps[@]} -eq 0 ]; then
  echo "SessionStart: no Jira_*.html apps found — nothing to check."
  exit 0
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fail=0

for app in "${apps[@]}"; do
  # Extract every inline (non-src) <script> block into its own .js file.
  count=$(APP="$app" OUT="$tmp" python3 - <<'PY'
import os, re
app = os.environ["APP"]; out = os.environ["OUT"]
html = open(app, encoding="utf-8").read()
blocks = re.findall(r'<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)</script>', html)
base = re.sub(r'[^A-Za-z0-9]+', '_', app)
for i, b in enumerate(blocks):
    open(os.path.join(out, f"{base}.{i}.js"), "w", encoding="utf-8").write(b)
print(len(blocks))
PY
)
  for js in "$tmp/$(echo "$app" | sed 's/[^A-Za-z0-9]\+/_/g')".*.js; do
    [ -e "$js" ] || continue
    if ! node --check "$js" >/dev/null 2>&1; then
      echo "‼️  Syntax error in $app: $(node --check "$js" 2>&1 | head -1)"
      fail=1
    fi
  done
  [ "$fail" -eq 0 ] && echo "✅ $app — ${count} inline script block(s) parse cleanly."
done

exit 0
