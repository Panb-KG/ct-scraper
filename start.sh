#!/bin/sh
set -e

echo "=== Starting ct-scraper ==="
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "HOST: $HOST"
echo "Current directory: $(pwd)"
echo "Listing files:"
ls -la

# 添加网络测试
echo ""
echo "=== Network Test ==="
echo "Checking DNS..."
nslookup google.com 2>/dev/null || cat /etc/resolv.conf
echo "Checking connectivity..."
curl -s --max-time 5 http://www.baidu.com > /dev/null && echo "✓ Network is working" || echo "✗ Network failed"

# 设置环境变量
export PORT=${PORT:-8080}
export HOST=${HOST:-0.0.0.0}

echo ""
echo "Starting Next.js on http://$HOST:$PORT..."

# 启动服务
node node_modules/next/dist/bin/next start --hostname "$HOST" --port "$PORT" &
PID=$!

# 等待服务启动
sleep 3

# 检查服务状态
echo ""
echo "=== Service Status ==="
if ps aux | grep -q "[n]ode.*next"; then
    echo "✓ Next.js is running with PID: $PID"
else
    echo "✗ Next.js is NOT running"
    exit 1
fi

# 检查端口监听
echo ""
echo "=== Port Check ==="
ss -tuln | grep -E ":$PORT" || echo "No process listening on port $PORT"

# 测试健康检查
echo ""
echo "=== Health Check Test ==="
curl -s http://localhost:$PORT/api/health && echo "" || echo "Health check failed"

# 保持进程运行
wait $PID
