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

# 复制 web - 标准方式
COPY --from=web-builder /app/web/.next ./web/.next
COPY --from=web-builder /app/web/public ./web/public
COPY --from=web-builder /app/web/node_modules ./web/node_modules
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

echo "Starting services..."
echo "PORT env: ${PORT:-8080}"

cd /app/server
echo "Starting Server on port 3001..."
SERVER_PORT=3001 HOST=0.0.0.0 node dist/index.js &
SERVER_PID=$!

sleep 3

cd /app/web
echo "Starting Next.js on port ${PORT:-8080}..."
HOST=0.0.0.0 PORT=${PORT:-8080} npm run start &
WEB_PID=$!

echo "Services started. Waiting..."
wait
STARTEOF
RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
