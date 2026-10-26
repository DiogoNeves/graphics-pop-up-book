#!/usr/bin/env bash
# Builds media/demo.mp4: records frames, synthesises the soundtrack, encodes H.264 + AAC.
# Needs the dev server on port 5183 (npm run dev -- --port 5183), Google Chrome and ffmpeg.
set -euo pipefail
cd "$(dirname "$0")/.."
WORK="${WORK:-$(mktemp -d)}"
mkdir -p media
if [ "${SKIP_RECORD:-0}" != "1" ]; then
  rm -rf "$WORK/frames"
  node scripts/record-demo.mjs "$WORK/frames"
fi
node scripts/make-soundtrack.mjs "$WORK/frames/cues.json" "$WORK/soundtrack.wav"
DUR=$(node -e "console.log(require('$WORK/frames/cues.json').duration)")
FADE_AT=$(node -e "console.log(($DUR - 1).toFixed(2))")
ffmpeg -loglevel error -y -framerate 30 -i "$WORK/frames/%05d.jpg" -i "$WORK/soundtrack.wav" \
  -vf "fade=t=in:st=0:d=0.5,fade=t=out:st=$FADE_AT:d=1" \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart \
  media/demo.mp4
echo "wrote media/demo.mp4 (frames in $WORK)"
