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

# 安装系统依赖（Playwright 需要）
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# 复制 server
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=server-builder /app/server/node_modules ./server/node_modules
COPY --from=server-builder /app/server/package.json ./server/

# 复制 web - Next.js standalone 模式
COPY --from=web-builder /app/web/.next/standalone ./web/.next/standalone
COPY --from=web-builder /app/web/.next/static ./web/.next/standalone/.next/static
COPY --from=web-builder /app/web/public ./web/.next/standalone/public
COPY --from=web-builder /app/web/package.json ./web/

# 复制 scraper
COPY --from=scraper-builder /app/scraper/node_modules ./scraper/node_modules
COPY --from=scraper-builder /app/scraper/src ./scraper/src
COPY --from=scraper-builder /app/scraper/package.json ./scraper/

RUN mkdir -p /app/server/data

ENV PLAYWRIGHT_BROWSERS_PATH=/usr/lib/chromium
ENV NEXT_PUBLIC_API_URL=http://localhost:3001

EXPOSE 8080

RUN cat > /app/start.sh << 'STARTEOF'
#!/bin/sh
set -e

# Zeabur 注入 $PORT 环境变量，Next.js 必须监听这个端口
# Fastify 后端用固定的 3001 端口，通过 Next.js API Proxy 转发

echo "Starting services..."
echo "PORT env: ${PORT:-8080}"

cd /app/server
echo "Starting Server on port 3001..."
SERVER_PORT=3001 HOST=0.0.0.0 node dist/index.js &
SERVER_PID=$!

sleep 3

cd /app/web
echo "Checking Next.js standalone files..."
ls -la .next/standalone/ 2>/dev/null || ls -la .next/

echo "Starting Next.js on port ${PORT:-8080}..."
HOST=0.0.0.0 PORT=${PORT:-8080} node .next/standalone/server.js &
WEB_PID=$!

# 等待任一子进程退出，然后清理
echo "Services started. Waiting..."
wait
STARTEOF
RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
