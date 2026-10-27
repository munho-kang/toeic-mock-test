#!/bin/bash
# Turn <workdir>/data.js into the finished test folder: 3 PDFs + MP3s + .source backup.
# Usage: build.sh <workdir> <output folder> [--no-audio]
#   --no-audio: skip MP3 rendering (use when only RC/print layout changed; existing MP3s are kept)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
W="$(cd "$1" && pwd)"; OUT="$2"; AUDIO="${3:-}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

node "$HERE/gen.js" "$W"
cd "$W/print"
for f in booklet answersheet answerkey; do
  "$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="$PWD/$f.pdf" "file://$PWD/$f.html" 2>/dev/null
done

mkdir -p "$OUT/.source"
cp booklet.pdf "$OUT/1_문제지.pdf"
cp answersheet.pdf "$OUT/2_답안지(OMR).pdf"
cp answerkey.pdf "$OUT/3_정답_스크립트_해설.pdf"
cp "$W/data.js" "$HERE/gen.js" "$HERE/audio.py" "$OUT/.source/"
for f in booklet answersheet answerkey; do echo "$f.pdf: $(pdfinfo $f.pdf | awk '/^Pages/{print $2}') pages"; done

if [ "$AUDIO" != "--no-audio" ]; then
  ALBUM="$(node -e 'const fs=require("fs"),vm=require("vm");const m=vm.runInNewContext(fs.readFileSync(process.argv[1],"utf8")+";typeof META===\"undefined\"?{}:META");console.log(`TOEIC 실전 모의고사 ${m.n||1}회${m.level?` (${m.level})`:""}`)' "$W/data.js")"
  python3 "$HERE/audio.py" "$W/print" "$OUT/듣기음원" "$ALBUM"
fi
echo "done → $OUT"
