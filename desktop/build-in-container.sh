#!/usr/bin/env bash
# Builds the desktop app in the build container (desktop/build.Containerfile), so the host needs neither the GTK and
# WebKit headers nor NSIS nor the Windows SDK. app/dist must already be built (production mode).
# Usage: desktop/build-in-container.sh linux|windows [out-dir]
#   linux   → teul_<v>_amd64.deb, teul-<v>-x86_64.AppImage
#   windows → teul-<v>-setup.exe (NSIS; cross-compiled with cargo-xwin)
# Caches (cargo registry, target, xwin's SDK, Tauri's tools) live in ~/.cache/teul-desktop.
set -euo pipefail
cd "$(dirname "$0")/.."
what="${1:?linux or windows}"
OUT="${2:-}"
VERSION="$(node -p "require('./app/package.json').version")"
[ -n "$OUT" ] || OUT="release/$VERSION"
mkdir -p "$OUT"
[ -f app/dist/index.html ] || { echo "error: app/dist is missing — run: npm --prefix app run build" >&2; exit 1; }

ENGINE="$(command -v podman || command -v docker || true)"
[ -n "$ENGINE" ] || { echo "error: podman or docker is needed" >&2; exit 1; }
IMAGE=teul-desktop-build
CACHE="${TEUL_DESKTOP_CACHE:-$HOME/.cache/teul-desktop}"
mkdir -p "$CACHE"/{registry,git,target,xwin,home}
if ! "$ENGINE" image exists "$IMAGE" 2>/dev/null && ! "$ENGINE" image inspect "$IMAGE" > /dev/null 2>&1; then
  "$ENGINE" build -t "$IMAGE" -f desktop/build.Containerfile desktop
fi
JOBS="${TEUL_JOBS:-3}"

case "$what" in
  linux) cmd='npx tauri build --bundles deb,appimage' ;;
  windows) cmd='npx tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc --bundles nsis' ;;
  *) echo "unknown target: $what" >&2; exit 2 ;;
esac

"$ENGINE" run --rm \
  -v "$PWD:/src" -w /src/desktop \
  -v "$CACHE/registry:/opt/cargo/registry" -v "$CACHE/git:/opt/cargo/git" \
  -v "$CACHE/target:/target" -v "$CACHE/xwin:/xwin" -v "$CACHE/home:/root" \
  -e CARGO_TARGET_DIR=/target -e XWIN_CACHE_DIR=/xwin -e XWIN_ACCEPT_LICENSE=1 -e CARGO_BUILD_JOBS="$JOBS" \
  -e APPIMAGE_EXTRACT_AND_RUN=1 -e NO_STRIP=true -e CI=true \
  "$IMAGE" bash -c "set -e; [ -x node_modules/.bin/tauri ] || npm ci --no-audit --no-fund; $cmd"

case "$what" in
  linux)
    cp "$CACHE/target/release/bundle/deb/teul_${VERSION}_amd64.deb" "$OUT/teul_${VERSION}_amd64.deb"
    cp "$CACHE/target/release/bundle/appimage/teul_${VERSION}_amd64.AppImage" "$OUT/teul-${VERSION}-x86_64.AppImage"
    chmod +x "$OUT/teul-${VERSION}-x86_64.AppImage"
    ;;
  windows)
    cp "$CACHE/target/x86_64-pc-windows-msvc/release/bundle/nsis/teul_${VERSION}_x64-setup.exe" "$OUT/teul-${VERSION}-setup.exe"
    ;;
esac
ls -l "$OUT"
