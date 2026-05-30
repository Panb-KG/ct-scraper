#!/bin/sh
echo "=== Starting ct-scraper ==="
echo "PORT: $PORT"
echo "HOSTNAME: $HOSTNAME"
echo "Starting Next.js..."
node server.js &
sleep 2
ss -tuln | grep -E ":$PORT"
curl -s http://localhost:$PORT/api/health || echo "Health check failed"
wait
