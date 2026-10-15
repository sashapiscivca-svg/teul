#!/usr/bin/env bash
# Renders teul's music (crates/teul-music) with the GeneralUser GS SoundFont and encodes it to Opus for the game.
# Usage: scripts/build-music.sh [mood ...]
# The SoundFont is downloaded once into .cache/ (not committed); only the encoded music is (app/public/music).
set -euo pipefail
cd "$(dirname "$0")/.."
source .toolchain/env.sh 2>/dev/null || true

SF2=.cache/soundfonts/GeneralUser-GS-main/GeneralUser-GS.sf2
SHA=9575028c7a1f589f5770fccc8cff2734566af40cd26ed836944e9a5152688cfe
if [ ! -f "$SF2" ]; then
  mkdir -p .cache/soundfonts
  curl -sL -o .cache/soundfonts/gugs.zip "https://github.com/mrbumpy409/GeneralUser-GS/archive/refs/heads/main.zip"
  (cd .cache/soundfonts && unzip -o -q gugs.zip)
fi
echo "$SHA  $SF2" | sha256sum -c --quiet

# the first pieces in stereo at 36 kb/s; the later ones (the hours, the seasons, the places, the feasts) in mono at
# 22 kb/s: they are softer and slower, and the game ships a lot of them
STEREO=" home village forest night cave fields farm race radio vinyl musicbox "
opus_of() {
  if [[ "$STEREO" == *" $1 "* ]]; then echo "-c:a libopus -b:a 36k"; else echo "-ac 1 -c:a libopus -b:a 22k"; fi
}

WAV=${MUSIC_WAV:-.cache/music-wav}
OUT=app/public/music
mkdir -p "$WAV" "$OUT"
cargo run -q --release -p teul-music -- "$SF2" "$WAV" "$@"

for wav in "$WAV"/*.wav; do
  name=$(basename "$wav" .wav)
  if [ $# -gt 0 ] && [[ ! " $* " =~ " $name " ]]; then continue; fi
  # two-pass EBU R128: quiet and even (-20 LUFS, peaks under -2 dBTP), then Opus
  stats=$(ffmpeg -hide_banner -nostats -i "$wav" -af loudnorm=I=-20:TP=-2:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
  mi=$(echo "$stats" | python3 -c 'import json,sys; print(json.load(sys.stdin)["input_i"])')
  mtp=$(echo "$stats" | python3 -c 'import json,sys; print(json.load(sys.stdin)["input_tp"])')
  mlra=$(echo "$stats" | python3 -c 'import json,sys; print(json.load(sys.stdin)["input_lra"])')
  mth=$(echo "$stats" | python3 -c 'import json,sys; print(json.load(sys.stdin)["input_thresh"])')
  ffmpeg -hide_banner -loglevel error -y -i "$wav" \
    -af "loudnorm=I=-20:TP=-2:LRA=11:measured_I=$mi:measured_TP=$mtp:measured_LRA=$mlra:measured_thresh=$mth:linear=true,aresample=48000" \
    $(opus_of "$name") -vbr on -application audio "$OUT/$name.ogg"
  printf '%-9s %6s KB\n' "$name" "$(( $(stat -c %s "$OUT/$name.ogg") / 1024 ))"
done
