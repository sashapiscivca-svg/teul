#!/usr/bin/env bash
# Checks what a change touched, not everything.
#   scripts/check.sh            — the checks for the files changed since the base (and the uncommitted ones)
#   scripts/check.sh --full     — everything; required before a merge into main and before a release
#   scripts/check.sh --base REF — compare with REF (default: the fork point from main, or HEAD on main)
#   scripts/check.sh --no-e2e   — skip the end-to-end suites
set -euo pipefail
cd "$(dirname "$0")/.."
# the project's own toolchain when installed (scripts/install-toolchain.sh); otherwise the one on PATH
if [ -f .toolchain/env.sh ]; then source .toolchain/env.sh; fi

full=0; e2e=1; base=""
while [ $# -gt 0 ]; do
  case "$1" in
    --full) full=1; shift ;;
    --no-e2e) e2e=0; shift ;;
    --base) base="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [ -z "$base" ]; then
  if [ "$(git rev-parse --abbrev-ref HEAD)" = main ] || ! git rev-parse -q --verify main > /dev/null; then base=HEAD
  else base=$(git merge-base HEAD main); fi
fi
changed=$( { git diff --name-only "$base"; git ls-files --others --exclude-standard; } | sort -u)

# What each place needs. A suite name is a file in app/e2e/.
gen=0; core=0; app=0; suites=()
want() { for s in "$@"; do [[ " ${suites[*]-} " == *" $s "* ]] || suites+=("$s"); done; }
if [ $full = 1 ]; then
  gen=1; core=1; app=1
  want flows paper wonders rift
else
  while IFS= read -r f; do
    case "$f" in
      scripts/*.py|content/*)
        gen=1
        want flows
        case "$f" in
          *rift*) want rift ;;
          *paper*|*daily*) want paper ;;
        esac ;;
      crates/*) core=1; want flows ;;
      app/src/*|app/test/*)
        app=1
        case "$f" in
          app/src/game.ts|app/src/pixel/*|app/src/scene.ts) want flows ;;
          app/src/wonders/*) want wonders ;;
          *rift*) want rift ;;
          *paper*) want paper ;;
        esac ;;
      # (a suite deleted since the base is not run)
      app/e2e/*.mjs) app=1; if [ -f "$f" ]; then want "$(basename "$f" .mjs)"; fi ;;
    esac
  done <<< "$changed"
fi

step() { printf '\n== %s\n' "$*"; }

if [ $gen = 1 ]; then
  step "content: generate, language, economy"
  python3 scripts/gen_base_content.py > /dev/null
  python3 scripts/lang_en.py --strict
  python3 scripts/check_economy.py
  core=1
fi

if [ $core = 1 ]; then
  step "core tests"
  cargo test -q --workspace
  step "wasm"
  scripts/build-wasm.sh --target web > /dev/null
  app=1
fi

if [ $app = 1 ]; then
  step "types"
  (cd app && npx tsc --noEmit)
  if [ $full = 1 ] || [ $core = 1 ]; then
    step "client tests: all"
    (cd app && npx vitest run)
  else
    files=$(grep -E '^app/(src|test)/.*\.ts$' <<< "$changed" | sed 's#^app/##' || true)
    if [ -n "$files" ]; then
      step "client tests: related to the change"
      # shellcheck disable=SC2086
      (cd app && npx vitest related --run $files)
    fi
  fi
fi

if [ $e2e = 1 ] && [ ${#suites[@]} -gt 0 ]; then
  step "end-to-end: ${suites[*]}"
  (cd app && npm run -s build:e2e > /dev/null)
  port=${CHECK_PORT:-4300}
  (cd app && exec node node_modules/vite/bin/vite.js preview --port "$port" --strictPort > /dev/null 2>&1) &
  preview=$!
  trap 'kill $preview 2>/dev/null || true' EXIT
  for _ in $(seq 60); do curl -sf "http://localhost:$port/" > /dev/null && break; sleep 0.5; done
  for s in "${suites[@]}"; do
    step "e2e $s"
    (cd app && BASE="http://localhost:$port/" node "e2e/$s.mjs")
  done
fi

printf '\nall checks passed\n'
