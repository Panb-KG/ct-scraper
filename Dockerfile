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

# 安装系统依赖
RUN apk add --no-cache \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ca-certificates \
  ttf-freefont \
  curl \
  iproute2

# 复制 Next.js standalone 构建
COPY --from=web-builder /app/web/.next/standalone ./
COPY --from=web-builder /app/web/.next/static ./.next/static
COPY --from=web-builder /app/web/public ./public
COPY --from=web-builder /app/web/package.json ./

# 复制启动脚本
COPY start.sh ./start.sh
RUN chmod +x start.sh

# 确保 data 目录存在
RUN mkdir -p /app/data

ENV PLAYWRIGHT_BROWSERS_PATH=/usr/lib/chromium
ENV NODE_ENV=production

EXPOSE 8080

# 使用启动脚本，设置环境变量
CMD ["sh", "-c", "export HOSTNAME=0.0.0.0 && export PORT=${PORT:-8080} && ./start.sh"]
