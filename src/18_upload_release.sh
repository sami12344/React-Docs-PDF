#!/usr/bin/env bash
# Uploads the release assets to GitHub release <id> (smallest first). Uses the token from git's credential helper;
# the token is never printed. Usage: bash src/18_upload_release.sh <release-id>
set -u
cd "$(dirname "$0")/.."
RID="$1"
REPO="sami12344/React-Docs-PDF"
TOKEN=$(printf "protocol=https\nhost=github.com\n\n" | git credential fill 2>/dev/null | sed -n 's/^password=//p')
FILES="output/React-Print-Edition-Master-Index.pdf output/React-Print-Edition-PROOF-12-pages.pdf"
for n in 5 9 8 1 6 7 2 3 4; do FILES="$FILES output/React-Print-Edition-Vol$n.pdf"; done
FILES="$FILES output/react-docs-print-source.zip output/React-Print-Edition-Combined.pdf"
for f in $FILES; do
  name=$(basename "$f")
  case "$name" in *.zip) ct=application/zip ;; *) ct=application/pdf ;; esac
  for try in 1 2 3; do
    code=$(curl -s -o build/upload-last.json -w "%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: $ct" \
      --data-binary @"$f" "https://uploads.github.com/repos/$REPO/releases/$RID/assets?name=$name")
    if [ "$code" = "201" ]; then echo "$(date +%H:%M:%S) uploaded $name ($(stat -c %s "$f") bytes)"; break; fi
    echo "$(date +%H:%M:%S) $name: HTTP $code (attempt $try) $(head -c 200 build/upload-last.json)"
    # a half-finished asset with the same name blocks a retry: remove it
    aid=$(curl -s -H "Authorization: Bearer $TOKEN" "https://api.github.com/repos/$REPO/releases/$RID/assets?per_page=100" | python -I -c "import sys,json; print(next((a['id'] for a in json.load(sys.stdin) if a['name']=='$name'), ''))")
    [ -n "$aid" ] && curl -s -X DELETE -H "Authorization: Bearer $TOKEN" "https://api.github.com/repos/$REPO/releases/assets/$aid"
  done
done
echo "$(date +%H:%M:%S) UPLOAD DONE"
