# 多阶段构建 - Server
FROM node:20-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server/ ./
RUN npm run build

# 多阶段构建 - Web
FROM node:20-alpine AS web-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ ./
RUN mkdir -p /app/web/public
RUN npm run build

# 多阶段构建 - Scraper
FROM node:20-alpine AS scraper-builder
WORKDIR /app/scraper
COPY scraper/package*.json ./
RUN npm install
COPY scraper/ ./

# 生产环境
FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    curl

COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=server-builder /app/server/node_modules ./server/node_modules
COPY --from=server-builder /app/server/package.json ./server/

COPY --from=web-builder /app/web/.next/standalone ./web/.next/standalone
COPY --from=web-builder /app/web/public ./web/.next/standalone/public
COPY --from=web-builder /app/web/package.json ./web/

COPY --from=scraper-builder /app/scraper/node_modules ./scraper/node_modules
COPY --from=scraper-builder /app/scraper/src ./scraper/src
COPY --from=scraper-builder /app/scraper/package.json ./scraper/

RUN mkdir -p /app/server/data

ENV PLAYWRIGHT_BROWSERS_PATH=/usr/lib/chromium
ENV NEXT_PUBLIC_API_URL=http://localhost:3001

EXPOSE 8080

RUN cat > /app/start.sh << 'STARTEOF'
#!/bin/sh
trap 'echo "Signal received, exiting..."; exit 0' INT TERM

echo "=== Starting services ==="
echo "PORT env: ${PORT:-8080}"
echo "NODE version: $(node --version)"

cd /app/server
echo "Starting Fastify Server on port 3001..."
SERVER_PORT=3001 node dist/index.js &
SERVER_PID=$!
echo "Server started with PID: $SERVER_PID"

sleep 3

cd /app/web/.next/standalone
echo "Starting Next.js standalone on port ${PORT:-8080}..."
echo "Setting HOSTNAME=0.0.0.0 (not HOST!)"
HOSTNAME=0.0.0.0 PORT=${PORT:-8080} node server.js 2>&1 &
WEB_PID=$!
echo "Next.js started with PID: $WEB_PID"

echo "Waiting for Next.js to be ready..."
for i in $(seq 1 20); do
    sleep 2
    
    echo "--- Check $i ---"
    if command -v ss > /dev/null; then
        ss -tuln | grep -E ":3001|:${PORT:-8080}"
    elif command -v netstat > /dev/null; then
        netstat -tuln | grep -E ":3001|:${PORT:-8080}"
    fi
    
    if curl -s http://localhost:${PORT:-8080}/api/health > /dev/null 2>&1; then
        echo "✅ Health check passed: http://localhost:${PORT:-8080}/api/health"
        break
    fi
    
    if curl -s http://127.0.0.1:${PORT:-8080}/api/health > /dev/null 2>&1; then
        echo "✅ Health check passed: http://127.0.0.1:${PORT:-8080}/api/health"
        break
    fi
    
    echo "Waiting... ($i/20)"
done

echo "=== All services started ==="
echo "Server PID: $SERVER_PID"
echo "Next.js PID: $WEB_PID"
echo "Final port check:"
ss -tuln 2>/dev/null || netstat -tuln 2>/dev/null

while true; do
    if ! kill -0 $SERVER_PID 2>/dev/null; then
        echo "❌ Server process died!"
    fi
    if ! kill -0 $WEB_PID 2>/dev/null; then
        echo "❌ Next.js process died!"
    fi
    sleep 10
done
STARTEOF
RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
