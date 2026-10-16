#!/usr/bin/env bash
# Builds the Rust core to WebAssembly and generates the JS bindings.
# Usage: scripts/build-wasm.sh [--target web|nodejs] [--out DIR] [--release]
# Without --release it builds the quicker wasm-dev profile (no LTO); releases and APKs pass --release.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .toolchain/env.sh ]; then source .toolchain/env.sh; fi

target=web
out=app/src/wasm
profile=wasm-dev
while [ $# -gt 0 ]; do
  case "$1" in
    --target) target="$2"; shift 2 ;;
    --out) out="$2"; shift 2 ;;
    --release) profile=release; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

# the paths of this checkout and of the cargo registry are not baked into the wasm (panic locations): the same
# source gives the same wasm wherever it is built. rustc tries the last --remap-path-prefix first, so the cargo
# home comes last: it wins even when it lies inside the checkout (the project's own .toolchain/cargo)
cargo_home="${CARGO_HOME:-$HOME/.cargo}"
export RUSTFLAGS="${RUSTFLAGS:-} --remap-path-prefix=$PWD=. --remap-path-prefix=$cargo_home=/cargo"
cargo build -p teul-wasm --target wasm32-unknown-unknown --profile "$profile"
mkdir -p "$out"
wasm-bindgen "target/wasm32-unknown-unknown/$profile/teul_wasm.wasm" --out-dir "$out" --target "$target" --typescript
ls -l "$out"/teul_wasm_bg.wasm | awk '{print "wasm size:", $5, "bytes"}'
