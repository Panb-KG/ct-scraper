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
# 确保 public 目录存在（可能只有 .gitkeep 或被 .dockerignore 排除）
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

# 复制 web
COPY --from=web-builder /app/web/.next ./web/.next
COPY --from=web-builder /app/web/public ./web/public
COPY --from=web-builder /app/web/node_modules ./web/node_modules
COPY --from=web-builder /app/web/package.json ./web/
# Next.js standalone 需要 public 和 static 在 standalone 目录下
RUN mkdir -p /app/web/.next/standalone/public /app/web/.next/standalone/.next && \
    cp -r /app/web/public/* /app/web/.next/standalone/public/ 2>/dev/null || true && \
    cp -r /app/web/.next/static /app/web/.next/standalone/.next/ 2>/dev/null || true

# 复制 scraper
COPY --from=scraper-builder /app/scraper/node_modules ./scraper/node_modules
COPY --from=scraper-builder /app/scraper/src ./scraper/src
COPY --from=scraper-builder /app/scraper/package.json ./scraper/

# 创建数据目录
RUN mkdir -p /app/server/data

# 设置 Playwright 浏览器路径
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/lib/chromium

WORKDIR /app/server
EXPOSE 3001

# 创建启动脚本
RUN cat > /app/start.sh << 'EOF'
#!/bin/sh
# 启动 Next.js 前端（standalone 模式，端口 3000）
cd /app/web
HOST=0.0.0.0 PORT=3000 node .next/standalone/server.js &
WEB_PID=$!

# 启动 Fastify 后端 API（端口 3001）
cd /app/server
node dist/index.js &
SERVER_PID=$!

# 等待任一进程退出
wait -n
echo "进程退出，停止所有服务"
kill $WEB_PID $SERVER_PID 2>/dev/null
wait
EOF
RUN chmod +x /app/start.sh
CMD ["/app/start.sh"]
