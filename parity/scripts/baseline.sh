#!/usr/bin/env bash
# Buat baseline visual & DOM dari Laravel di mesin ini (.baseline/<platform>, tidak di-commit), buktikan
# deterministik dengan run kedua (Laravel dinyalakan ulang: DB & kunci baru), lalu cocokkan dengan
# visual/manifest.json. `npm run baseline -- tulis` mengganti entri manifest platform ini.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -z "${BASE_URL:-}" ] || { echo "baseline hanya dari Laravel: kosongkan BASE_URL" >&2; exit 1; }
MODE="${1:-cek}"
rm -rf ".baseline/$(node -p process.platform)"

npx playwright test tests/visual.spec.ts --update-snapshots=all
npx playwright test tests/visual.spec.ts
node scripts/manifest.mjs "$MODE"
