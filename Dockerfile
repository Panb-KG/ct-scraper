# ============================================================
# ct-scraper 全量 Docker 构建
# 包含：server (Fastify) + scraper (Playwright) + web (Next.js)
# ============================================================

# ---- 阶段1: 构建 Next.js 前端 ----
FROM node:20-slim AS web-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ ./
RUN mkdir -p public
RUN npm run build

# ---- 阶段2: 构建 server ----
FROM node:20-slim AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server/ ./
RUN npm run build

# ---- 阶段3: 构建 scraper ----
FROM node:20-slim AS scraper-builder
WORKDIR /app/scraper
COPY scraper/package*.json ./
RUN npm install
COPY scraper/ ./
RUN npm run build

# ---- 最终阶段 ----
FROM node:20-slim

WORKDIR /app

# 安装 Playwright 需要的完整系统依赖（Debian 版）
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libfreetype6 libharfbuzz0b libfontconfig1 \
    libdrm2 libx11-6 libxcomposite1 libxdamage1 libxext6 libxfixes3 libxrandr2 \
    libgbm1 libpango-1.0-0 libcairo2 libasound2 libxshmfence1 libx11-xcb1 \
    libatk1.0-0 libatk-bridge2.0-0 libcups2 libdbus-1-3 \
    ca-certificates fonts-freefont-ttf curl iproute2 \
    && rm -rf /var/lib/apt/lists/*

# 复制 server
COPY --from=server-builder /app/server ./server
RUN cd server && npm install --omit=dev

# 复制 scraper（含 node_modules）
COPY --from=scraper-builder /app/scraper ./scraper

# 安装 Playwright 浏览器
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
