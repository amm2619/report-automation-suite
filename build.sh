#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$SCRIPT_DIR/src"

# Read version from 01-state.js
VERSION=$(grep -oP "APP_VERSION='v\K[^']+" "$SRC/js/01-state.js" || echo "0.0")
DATESTAMP=$(date +%Y%m%d)
OUT="$SCRIPT_DIR/Jira_ReportSuite_v${VERSION//./_}_${DATESTAMP}.html"

# Allow override: ./build.sh output.html
if [[ "${1:-}" != "" && "${1:-}" != "verify" ]]; then
  OUT="$1"
fi

{
  # Head
  cat "$SRC/head.html"

  # CSS
  echo '<style>'
  cat "$SRC/styles.css"
  echo '</style>'

  # Body HTML
  cat "$SRC/body.html"

  # Vendor: pptxgenjs
  echo ''
  echo '<!-- pptxgenjs v3.12.0 browser bundle -->'
  echo '<script>'
  cat "$SRC/vendor/pptxgenjs.js"
  echo '</script>'

  # Vendor: xlsx-js-style
  echo ''
  echo '<!-- xlsx-js-style v1.2.0 browser bundle -->'
  echo '<script>'
  cat "$SRC/vendor/xlsx-js-style.js"
  echo '</script>'

  # Main app script (all JS modules + tests + MI shim in one block)
  echo ''
  echo '<script>'
  for f in "$SRC"/js/[0-9][0-9]-*.js; do
    cat "$f"
  done
  cat "$SRC/tests/test-harness.js"
  cat "$SRC/tail/mi-shim.js"
  echo ''
  echo ''
  echo '</script>'

  # Footer (velocity-report.js + closing tags)
  cat "$SRC/footer.html"

} > "$OUT"

echo "Built: $OUT ($(wc -l < "$OUT") lines, $(du -h "$OUT" | cut -f1))"

# Verify mode: compare against a reference file
if [[ "${1:-}" == "verify" ]]; then
  REF="$SCRIPT_DIR/Jira_ReportSuite_v${VERSION//./_}_*.html"
  # shellcheck disable=SC2086
  REF_FILE=$(ls $REF 2>/dev/null | head -1)
  if [[ -z "$REF_FILE" ]]; then
    echo "No reference file found matching $REF"
    exit 1
  fi
  if diff -q "$REF_FILE" "$OUT" > /dev/null 2>&1; then
    echo "PASS: Output identical to $REF_FILE"
  else
    echo "DIFF: Output differs from $REF_FILE"
    diff "$REF_FILE" "$OUT" | head -30
    exit 1
  fi
fi
