#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
source ~/.nvm/nvm.sh >/dev/null
nvm use >/dev/null

PORT=4173
OUT="shots/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"

LOG="$(mktemp -t build).log"
npm run build >"$LOG" 2>&1 || { cat "$LOG"; rm -f "$LOG"; exit 1; }
rm -f "$LOG"

STARTED=0
if ! curl -s -o /dev/null "http://localhost:$PORT/"; then
  npx vite preview --port "$PORT" --strictPort >/dev/null 2>&1 &
  SERVER=$!
  STARTED=1
  for _ in $(seq 1 20); do
    curl -s -o /dev/null "http://localhost:$PORT/" && break
    sleep 0.5
  done
fi

ACTIONS="$(mktemp -t screens).json"
sed "s#__OUT__#$OUT#g" tools/screens.template.json > "$ACTIONS"
node tools/shot.mjs "http://localhost:$PORT/" 390x844 "$ACTIONS" | grep -v "^SHOT\|^EVAL"

SE_OUT="$OUT/se"
mkdir -p "$SE_OUT"
sed "s#__OUT__#$SE_OUT#g" tools/screens.template.json > "$ACTIONS"
node tools/shot.mjs "http://localhost:$PORT/" 375x667 "$ACTIONS" | grep -v "^SHOT\|^EVAL"

if [ "$STARTED" = "1" ]; then kill "$SERVER" 2>/dev/null || true; fi
rm -f "$ACTIONS"
echo "$OUT"
