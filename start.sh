#!/bin/sh
echo "=== Starting ct-scraper ==="
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "HOST: $HOST"
echo "Current directory: $(pwd)"
echo "Listing files:"
ls -la

# 设置环境变量
export PORT=${PORT:-8080}
export HOST=${HOST:-0.0.0.0}

echo ""
echo "Starting Next.js on http://$HOST:$PORT..."
echo "---"

# 直接运行 Next.js，不使用后台模式，这样可以看到完整输出
exec node node_modules/next/dist/bin/next start --hostname "$HOST" --port "$PORT"
