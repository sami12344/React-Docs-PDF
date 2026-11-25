#!/usr/bin/env bash
# Builds every volume of the edition in order (one at a time: Chrome needs the memory).
# Run it twice: the second round fills in page numbers of links that point into other volumes.
# Usage: bash src/build_all.sh [round-label]
set -u
cd "$(dirname "$0")/.."
ROUND="${1:-r1}"
mkdir -p build/logs
VOLS=$(node -e "console.log(require('./src/volumes.json').volumes.filter(v=>!v.proof).map(v=>v.id).join(' '))")
for v in $VOLS; do
  echo "$(date +%H:%M:%S) start $v" >> build/logs/build_all.log
  bash src/make.sh "$v" > "build/logs/$v-$ROUND.log" 2>&1
  rc=$?
  echo "$(date +%H:%M:%S) end $v rc=$rc" >> build/logs/build_all.log
done
echo "$(date +%H:%M:%S) ROUND $ROUND DONE" >> build/logs/build_all.log
