#!/bin/zsh
# Wartet, bis sich ein wichtiger Zähler ändert, und meldet dann "NEU ..."
K="buy-click trainer ride-1m ride-3m ride-10m offer-ride10 buy-ride10 unlock-ok teaser-10s calc-use"
read_counts() {
  curl -s -A "Mozilla/5.0 pedalcraft-watch" https://pedalcraft-stats.pages.dev/all | K="$K" python3 -c '
import json,os,sys
try: d=json.load(sys.stdin)
except Exception: sys.exit(1)
print(" ".join(str(d.get(k,0)) for k in os.environ["K"].split()))'
}
A=$(read_counts)
while true; do
  sleep 300
  B=$(read_counts) || continue
  [[ -z "$A" ]] && A=$B
  if [[ -n "$B" && "$B" != "$A" ]]; then echo "NEU ($K): $B vorher $A"; exit 0; fi
done
