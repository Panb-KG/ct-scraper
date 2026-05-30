# 多阶段构建
FROM node:20-alpine AS web-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ ./
RUN mkdir -p public
RUN npm run build

# 生产环境
FROM node:20-alpine
WORKDIR /app

# 安装系统依赖（虽然我们不用 playwright 爬取了，但保留库以防万一）
RUN apk add --no-cache \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ca-certificates \
  ttf-freefont

# 复制 Next.js standalone 构建
COPY --from=web-builder /app/web/.next/standalone ./
COPY --from=web-builder /app/web/.next/static ./.next/static
COPY --from=web-builder /app/web/public ./public
COPY --from=web-builder /app/web/package.json ./

# 确保 data 目录存在
RUN mkdir -p /app/data

ENV PLAYWRIGHT_BROWSERS_PATH=/usr/lib/chromium
# 前端调用 API 使用相对路径，不需要 NEXT_PUBLIC_API_URL

EXPOSE 3000

# 启动 Next.js 服务
CMD ["node", "server.js"]
