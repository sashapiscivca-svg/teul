#!/usr/bin/env bash
# The instruments the hero plays (one note every three semitones, mono) and the records (pieces from
# scripts/scores.py arranged for a small band), rendered with GeneralUser GS and encoded to Opus.
# Usage: scripts/build-media-audio.sh   (after scripts/build-music.sh has fetched the SoundFont)
set -euo pipefail
cd "$(dirname "$0")/.."
source .toolchain/env.sh 2>/dev/null || true
SF2=.cache/soundfonts/GeneralUser-GS-main/GeneralUser-GS.sf2
[ -f "$SF2" ] || { echo "no SoundFont: run scripts/build-music.sh first" >&2; exit 1; }
python3 scripts/scores.py >/dev/null
WAV=.cache/media-wav
mkdir -p "$WAV/kit" "$WAV/rec" app/public/music/kit app/public/music/rec
cargo run -q --release -p teul-music -- "$SF2" "$WAV/kit" --sprites
cargo run -q --release -p teul-music -- "$SF2" "$WAV/rec" --records crates/teul-music/records.json
for wav in "$WAV"/kit/*.wav; do
  name=$(basename "$wav" .wav)
  # the slots must stay where they are: no resampling tricks, no trimming
  ffmpeg -hide_banner -loglevel error -y -i "$wav" -ac 1 -ar 48000 -c:a libopus -b:a 40k -vbr on -application audio "app/public/music/kit/$name.ogg"
  printf 'kit %-10s %6s KB\n' "$name" "$(( $(stat -c %s "app/public/music/kit/$name.ogg") / 1024 ))"
done
for wav in "$WAV"/rec/*.wav; do
  name=$(basename "$wav" .wav)
  ffmpeg -hide_banner -loglevel error -y -i "$wav" -af "loudnorm=I=-20:TP=-2:LRA=11,aresample=48000" -c:a libopus -b:a 32k -vbr on -application audio "app/public/music/rec/$name.ogg"
  printf 'rec %-18s %6s KB\n' "$name" "$(( $(stat -c %s "app/public/music/rec/$name.ogg") / 1024 ))"
done
