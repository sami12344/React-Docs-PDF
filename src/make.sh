#!/usr/bin/env bash
# Builds one volume: assemble HTML -> render PDF -> read page numbers back (repeat until stable) -> post-process.
# Usage: bash src/make.sh <volume-id>
set -u
VOL="${1:-proof}"
cd "$(dirname "$0")/.."
PY="python -I -X utf8"
for pass in 1 2 3 4; do
  echo "== $VOL pass $pass"
  node src/05_book.mjs "$VOL" || exit 1
  if [ $pass -eq 1 ]; then node src/overflow.mjs "$VOL" || exit 1; fi
  # Chrome can stall or crash when memory is short: try the render up to three times
  ok=0
  for try in 1 2 3; do
    if node src/06_render.mjs "$VOL"; then ok=1; break; fi
    echo "render attempt $try failed"
  done
  [ $ok -eq 1 ] || exit 1
  $PY src/07_pagemap.py "$VOL"; rc=$?
  if [ $rc -eq 0 ]; then echo "page numbers stable after pass $pass"; break; fi
  if [ $rc -ne 3 ]; then exit $rc; fi
done
$PY src/08_post.py "$VOL"
