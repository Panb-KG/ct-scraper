#!/bin/sh
set -e

echo "=== Starting ct-scraper ==="
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "HOSTNAME: $HOSTNAME"
echo "Current directory: $(pwd)"
echo "Listing files:"
ls -la

# 设置环境变量
export HOSTNAME=0.0.0.0
export PORT=${PORT:-8080}

echo ""
echo "Starting Next.js on http://$HOSTNAME:$PORT..."

# 启动服务
node server.js
