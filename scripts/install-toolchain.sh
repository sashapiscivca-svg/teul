#!/usr/bin/env bash
# The project's own toolchain, in .toolchain: Rust (stable, with the wasm32 target), wasm-bindgen-cli matching
# Cargo.lock, and a JDK 21 for the Android build. Run once: bash scripts/install-toolchain.sh (it writes .toolchain/,
# which git ignores; scripts/build-wasm.sh and build-apk.sh source .toolchain/env.sh)
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .toolchain && cd .toolchain
T=$(pwd)
export RUSTUP_HOME=$T/rustup CARGO_HOME=$T/cargo
if [ ! -x "$CARGO_HOME/bin/cargo" ]; then
  curl -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path --profile minimal --default-toolchain stable
fi
"$CARGO_HOME/bin/rustup" target add wasm32-unknown-unknown
V=$(grep -A1 'name = "wasm-bindgen"' ../Cargo.lock | sed -n 's/version = "\(.*\)"/\1/p')
"$CARGO_HOME/bin/cargo" install wasm-bindgen-cli --version "$V" --locked
if [ ! -d jdk21 ]; then
  curl -sSL -o jdk.tgz 'https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/eclipse'
  mkdir jdk21 && tar -xzf jdk.tgz -C jdk21 --strip-components=1 && rm jdk.tgz
fi
cat > env.sh <<'ENV'
# Source me: the project's own toolchain (see scripts/install-toolchain.sh).
TOOLCHAIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export TOOLCHAIN_DIR
export RUSTUP_HOME=$TOOLCHAIN_DIR/rustup
export CARGO_HOME=$TOOLCHAIN_DIR/cargo
export JAVA_HOME=$TOOLCHAIN_DIR/jdk21
export ANDROID_HOME=${ANDROID_HOME:-/opt/android-sdk}
export PATH=$CARGO_HOME/bin:$JAVA_HOME/bin:$PATH
ENV
echo done
