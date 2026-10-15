#!/usr/bin/env bash
# Builds every release into release/<version>/ (the version is app/package.json "version"):
#   teul-<v>.apk, teul-<v>.aab              Android (signed with ~/.teul-release, minified)
#   teul_<v>_amd64.deb, teul-<v>-x86_64.AppImage   Linux (Tauri, in the build container)
#   teul-<v>-setup.exe                      Windows (Tauri NSIS, cross-compiled with cargo-xwin in the container)
#   SHA256SUMS, INSTALL.md
# Every run first raises the patch number (1.0.0 → 1.0.1; 1.0.99 → 1.1.0), so each build
# installs over the previous one as an update. --same-version rebuilds the current one.
# Usage: scripts/release.sh [--same-version] [--no-android] [--no-linux] [--no-windows] [--no-web]
set -euo pipefail
cd "$(dirname "$0")/.."
source .toolchain/env.sh

android=1 linux=1 windows=1 web=1 bump=1
for a in "$@"; do
  case "$a" in
    --same-version) bump=0 ;;
    --no-android) android=0 ;;
    --no-linux) linux=0 ;;
    --no-windows) windows=0 ;;
    --no-web) web=0 ;;
    *) echo "unknown argument: $a" >&2; exit 2 ;;
  esac
done

if [ "$bump" = 1 ]; then
  # Android's versionCode is major*10000 + minor*100 + patch, so patch stays below 100
  node -e '
    const fs = require("fs");
    const files = ["app/package.json", "app/package-lock.json"];
    const pkg = JSON.parse(fs.readFileSync(files[0], "utf8"));
    let [ma, mi, pa] = pkg.version.split(/[.-]/).map(Number);
    if (++pa > 99) { pa = 0; mi += 1; }
    if (mi > 99) { mi = 0; ma += 1; }
    const v = `${ma}.${mi}.${pa}`;
    for (const f of files) {
      const j = JSON.parse(fs.readFileSync(f, "utf8"));
      j.version = v;
      if (j.packages && j.packages[""]) j.packages[""].version = v;
      fs.writeFileSync(f, JSON.stringify(j, null, 2) + "\n");
    }
  '
fi
VERSION="$(node -p "require('./app/package.json').version")"
OUT="release/$VERSION"
mkdir -p "$OUT"
echo "== teul $VERSION → $OUT"

if [ "$web" = 1 ]; then
  echo "== wasm + web (production)"
  scripts/build-wasm.sh --target web --release > /dev/null
  npm --prefix app run build > /dev/null
fi
# a release must never carry the test hook (window.__teul is guarded by MODE !== 'production')
if grep -rq "__teul" app/dist/assets/*.js; then
  echo "error: app/dist contains the debug hook — not a production build" >&2
  exit 1
fi

[ "$android" = 1 ] && { echo "== android"; scripts/build-android-release.sh --no-web; }
[ "$linux" = 1 ] && { echo "== linux"; desktop/build-in-container.sh linux "$OUT"; }
[ "$windows" = 1 ] && { echo "== windows"; desktop/build-in-container.sh windows "$OUT"; }

sed "s/{{VERSION}}/$VERSION/g" scripts/release-INSTALL.md > "$OUT/INSTALL.md"
(cd "$OUT" && rm -f SHA256SUMS && sha256sum -- $(ls | grep -v -e '^SHA256SUMS$' -e '^INSTALL.md$') > SHA256SUMS)
echo "== done"
ls -l "$OUT"
cat "$OUT/SHA256SUMS"
