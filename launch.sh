#!/bin/bash
cd /home/snuc/.openclaw/workspace/foresight-bi
pkill -f "http-server.*8080" 2>/dev/null
sleep 1
npx http-server -p 8080 -c-1 &
sleep 2
xdg-open http://localhost:8080
