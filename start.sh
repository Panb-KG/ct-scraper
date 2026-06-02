#!/bin/sh
set -e

echo "=== Starting ct-scraper ==="
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "Current directory: $(pwd)"
echo ""

# 默认配置
export PORT=${PORT:-8080}
export HOST=${HOST:-0.0.0.0}
export SERVER_PORT=${SERVER_PORT:-3001}

# 初始化数据库
echo "--- Initializing database ---"
cd /app/server
node dist/db/init.js 2>/dev/null || echo "(db init skipped, will auto-create on first query)"
cd /app

# 启动 Fastify 后端
echo "--- Starting Fastify server on port $SERVER_PORT ---"
cd /app/server
node dist/index.js &
SERVER_PID=$!
cd /app

# 等待 server 启动
sleep 3

# 检查 server 是否正常启动
if kill -0 $SERVER_PID 2>/dev/null; then
  echo "Server started (PID $SERVER_PID)"
else
  echo "ERROR: Server failed to start"
  exit 1
fi

# 自动全量爬取（部署后首次运行）
if [ "$AUTO_SCRAPE" = "true" ]; then
  echo ""
  echo "=== Auto-scrape enabled, starting full scrape ==="
  cd /app/scraper
  node dist/scraper.js --pages 5 &
  SCRAPER_PID=$!
  cd /app
  echo "Scraper started in background (PID $SCRAPER_PID)"
  echo "Monitor with: curl http://localhost:3001/api/scrape/stats"
else
  echo ""
  echo "Auto-scrape disabled. Set AUTO_SCRAPE=true to enable."
  echo "Manual trigger: curl -X POST http://localhost:3001/api/scrape/tasks/full"
fi

echo ""
echo "=== All services started ==="
echo "  API:  http://localhost:$SERVER_PORT"
echo "  Web:  http://localhost:$PORT"
echo ""

# 保持容器运行
wait $SERVER_PID
