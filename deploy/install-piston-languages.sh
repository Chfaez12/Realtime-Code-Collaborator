#!/usr/bin/env bash
# Installs the programming languages into Piston. Run once, after the first start.
set -euo pipefail

NETWORK=$(docker inspect piston -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}')
BASE="http://piston:2000/api/v2"

api() {
  docker run --rm --network "$NETWORK" curlimages/curl:latest -sS --max-time 1800 "$@"
}

PACKAGES=$(api "$BASE/packages")

latest_version() {
  echo "$PACKAGES" | python3 -c '
import json, sys
name = sys.argv[1]
def key(v):
    return tuple(int(p) if p.isdigit() else 0 for p in v.replace("-", ".").split("."))
items = [p for p in json.load(sys.stdin) if p["language"] == name]
print(max(items, key=lambda p: key(p["language_version"]))["language_version"] if items else "")
' "$1"
}

for name in python node typescript java gcc go rust php ruby; do
  version=$(latest_version "$name")
  if [ -z "$version" ]; then
    echo "!! No package named '$name'"
    continue
  fi
  echo "Installing $name $version (this can take a few minutes)..."
  api -X POST "$BASE/packages" -H "Content-Type: application/json" \
    -d "{\"language\":\"$name\",\"version\":\"$version\"}" || echo "  failed"
  echo
done

echo "Installed languages:"
api "$BASE/runtimes" | python3 -c 'import json,sys; print(sorted({r["language"] for r in json.load(sys.stdin)}))'