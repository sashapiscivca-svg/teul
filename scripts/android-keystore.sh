#!/usr/bin/env bash
# Makes the Android release keystore once, outside the repository: ~/.teul-release/teul-release.jks with a random
# password in ~/.teul-release/keystore.properties. Never commit either. Losing them means updates can no longer be
# installed over the app already on people's phones (see docs/release.md: back them up).
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .toolchain/env.sh ] && source .toolchain/env.sh
DIR="${TEUL_RELEASE_DIR:-$HOME/.teul-release}"
JKS="$DIR/teul-release.jks"
PROPS="$DIR/keystore.properties"
if [ -f "$JKS" ] && [ -f "$PROPS" ]; then
  echo "keystore: $JKS (already there)"
  exit 0
fi
if [ -f "$JKS" ] || [ -f "$PROPS" ]; then
  echo "error: only one of $JKS / $PROPS exists; refusing to overwrite" >&2
  exit 1
fi
mkdir -p "$DIR"
chmod 700 "$DIR"
PASS="$(openssl rand -base64 33 | tr -d '/+=\n' | cut -c1-32)"
umask 077
keytool -genkeypair -v -keystore "$JKS" -storetype PKCS12 -alias teul -keyalg RSA -keysize 4096 -validity 10000 \
  -storepass "$PASS" -keypass "$PASS" -dname "CN=teul, O=teul" > /dev/null 2>&1
cat > "$PROPS" <<P
storeFile=$JKS
storePassword=$PASS
keyAlias=teul
keyPassword=$PASS
P
chmod 600 "$JKS" "$PROPS"
echo "keystore made: $JKS (password in $PROPS) — back both up somewhere safe"
