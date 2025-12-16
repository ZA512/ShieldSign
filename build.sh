#!/usr/bin/env bash
set -euo pipefail

# Build packages for Chrome (Manifest V3) and Firefox (Manifest V2) on Linux/macOS.
# Chrome uses manifest.json (MV3). Firefox swaps in manifest.firefox.json (MV2) inside the archive.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "error: $1 is required" >&2; exit 1; }
}

require_cmd zip
require_cmd python3

VERSION=$(python3 - <<'PY'
import json, pathlib
path = pathlib.Path('manifest.json')
with path.open() as f:
    data = json.load(f)
print(data.get('version', '0.0.0'))
PY
)

PROJECT="ShieldSign"
OUTPUT_DIR="$ROOT_DIR/releases"
mkdir -p "$OUTPUT_DIR"

INCLUDE_ITEMS=(
  "background.js"
  "content.js"
  "compat.js"
  "icons"
  "popup"
  "options"
  "_locales"
  "schemas"
  "shieldsign_public_list_v1.json"
)

package_zip() {
  local manifest_src="$1" # source manifest path
  local out_path="$2"     # destination archive path

  local staging
  staging=$(mktemp -d)
  trap 'rm -rf "$staging"' EXIT

  cp "$manifest_src" "$staging/manifest.json"
  for item in "${INCLUDE_ITEMS[@]}"; do
    cp -r "$ROOT_DIR/$item" "$staging/"
  done

  (cd "$staging" && zip -qr "$out_path" .)

  rm -rf "$staging"
  trap - EXIT
}

# Chrome (Manifest V3)
CHROME_ZIP="$OUTPUT_DIR/${PROJECT}_v${VERSION}_chrome.zip"
rm -f "$CHROME_ZIP"
package_zip "$ROOT_DIR/manifest.json" "$CHROME_ZIP"
echo "[Chrome] Created $CHROME_ZIP"

# Firefox (Manifest V2) - also emit .xpi
FIREFOX_ZIP="$OUTPUT_DIR/${PROJECT}_v${VERSION}_firefox.zip"
FIREFOX_XPI="$OUTPUT_DIR/${PROJECT}_v${VERSION}.xpi"
rm -f "$FIREFOX_ZIP" "$FIREFOX_XPI"
package_zip "$ROOT_DIR/manifest.firefox.json" "$FIREFOX_ZIP"
cp "$FIREFOX_ZIP" "$FIREFOX_XPI"
echo "[Firefox] Created $FIREFOX_ZIP and $FIREFOX_XPI (MV2)"

echo "Done. Version: $VERSION"
