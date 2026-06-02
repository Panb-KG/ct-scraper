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

# 1. 启动 Fastify 后端
echo "--- Starting Fastify server on port $SERVER_PORT ---"
cd /app/server
node dist/index.js &
SERVER_PID=$!
cd /app

# 等待后端启动
sleep 3
if kill -0 $SERVER_PID 2>/dev/null; then
  echo "Server started (PID $SERVER_PID)"
else
  echo "ERROR: Server failed to start"
  exit 1
fi

# 2. 启动 Next.js 前端
echo "--- Starting Next.js on port $PORT ---"
cd /app/web
node node_modules/next/dist/bin/next start --hostname "$HOST" --port "$PORT" &
WEB_PID=$!
cd /app

sleep 2
if kill -0 $WEB_PID 2>/dev/null; then
  echo "Web started (PID $WEB_PID)"
else
  echo "ERROR: Web failed to start"
  exit 1
fi

# 3. 部署后自动全量爬取（后台运行，不阻塞健康检查）
if [ "$AUTO_SCRAPE" = "true" ]; then
  echo ""
  echo "=== Auto-scrape enabled, starting full scrape ==="
  cd /app/scraper
  node dist/scraper.js --pages 5 &
  SCRAPER_PID=$!
  cd /app
  echo "Scraper started in background (PID $SCRAPER_PID)"
  echo "Monitor: curl http://localhost:$SERVER_PORT/api/scrape/stats"
else
  echo ""
  echo "Auto-scrape disabled. Set AUTO_SCRAPE=true to enable."
  echo "Manual trigger: cd /app/scraper && node dist/scraper.js --pages 5"
fi

echo ""
echo "=== All services started ==="
echo "  API:  http://localhost:$SERVER_PORT"
echo "  Web:  http://localhost:$PORT"
echo ""

# 保持容器运行，任一进程退出则整体退出
wait $SERVER_PID $WEB_PID
