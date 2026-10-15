#!/usr/bin/env bash
# Builds the debug APK: WASM core, web app, Capacitor sync, Gradle.
set -euo pipefail
cd "$(dirname "$0")/.."
source .toolchain/env.sh

scripts/build-wasm.sh --target web --release > /dev/null
npm --prefix app run build
(cd app && npx cap sync android)
(cd app/android && ./gradlew assembleDebug --console=plain)
ls -l app/android/app/build/outputs/apk/debug/app-debug.apk
