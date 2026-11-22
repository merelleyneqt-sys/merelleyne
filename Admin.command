#!/bin/zsh
# Double-click to open the Merelleyne admin (works only on this Mac).
cd "$(dirname "$0")"
PORT=8765
if ! curl -s -o /dev/null "http://localhost:$PORT/api/tracks"; then
  lsof -ti tcp:$PORT | xargs kill 2>/dev/null   # old preview server without admin
  python3 scripts/serve.py $PORT &
  for i in {1..30}; do curl -s -o /dev/null "http://localhost:$PORT/api/tracks" && break; sleep 0.2; done
fi
open "http://localhost:$PORT/admin/"
echo "Admin is running. Keep this window open while you work; close it when done."
wait
