# ============================================================
# ct-scraper 全量 Docker 构建
# 包含：server (Fastify) + scraper (Playwright) + web (Next.js)
# ============================================================

# ---- 阶段1: 构建 Next.js 前端 ----
FROM node:20-alpine AS web-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ ./
RUN mkdir -p public
RUN npm run build

# ---- 阶段2: 构建 server ----
FROM node:20-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server/ ./
RUN npm run build

# ---- 阶段3: 构建 scraper ----
FROM node:20-alpine AS scraper-builder
WORKDIR /app/scraper
COPY scraper/package*.json ./
RUN npm install
COPY scraper/ ./
RUN npm run build

# ---- 最终阶段 ----
FROM node:20-alpine

WORKDIR /app

# 安装系统依赖（Playwright 浏览器运行需要）
RUN apk add --no-cache \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    curl \
    iproute2 \
    bind-tools

# 复制 server
COPY --from=server-builder /app/server ./server
RUN cd server && npm install --omit=dev

# 复制 scraper（含 node_modules，这样 playwright 版本已知）
COPY --from=scraper-builder /app/scraper ./scraper

# 在最终阶段安装 Playwright 浏览器（环境变量确保安装到正确路径）
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN cd /app/scraper && npx playwright install chromium

# 复制 web
COPY --from=web-builder /app/web/node_modules ./web/node_modules
COPY --from=web-builder /app/web/package.json ./web/package.json
COPY --from=web-builder /app/web/.next ./web/.next
COPY --from=web-builder /app/web/public ./web/public

# 复制启动脚本
COPY start.sh ./start.sh
RUN chmod +x start.sh

# 环境变量
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

# 确保 data 目录存在
RUN mkdir -p /app/server/data

EXPOSE 8080

CMD ["./start.sh"]
