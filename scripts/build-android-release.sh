#!/usr/bin/env bash
# Builds the signed, minified Android release: release/<version>/teul-<version>.apk (to install by hand) and
# teul-<version>.aab (for a store). Usage: scripts/build-android-release.sh [--no-web]  (--no-web: app/dist is fresh)
set -euo pipefail
cd "$(dirname "$0")/.."
source .toolchain/env.sh
# the build's time is the commit's time, so one commit always builds the same files (reproducible builds)
export SOURCE_DATE_EPOCH="${SOURCE_DATE_EPOCH:-$(git log -1 --format=%ct)}"
web=1
for a in "$@"; do case "$a" in --no-web) web=0 ;; *) echo "unknown argument: $a" >&2; exit 2 ;; esac; done

VERSION="$(node -p "require('./app/package.json').version")"
OUT="release/$VERSION"
mkdir -p "$OUT"
scripts/android-keystore.sh
if [ "$web" = 1 ]; then
  scripts/build-wasm.sh --target web --release > /dev/null
  npm --prefix app run build
fi
(cd app && npx cap sync android)
(cd app/android && ./gradlew assembleRelease bundleRelease --console=plain -q)

APK=app/android/app/build/outputs/apk/release/app-release.apk
AAB=app/android/app/build/outputs/bundle/release/app-release.aab
BT="$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)"
"$BT/apksigner" verify --print-certs "$APK" | head -3
cp "$APK" "$OUT/teul-$VERSION.apk"
cp "$AAB" "$OUT/teul-$VERSION.aab"
ls -l "$OUT/teul-$VERSION.apk" "$OUT/teul-$VERSION.aab"
