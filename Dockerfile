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
WORKDIR /app/web

# 安装系统依赖
RUN apk add --no-cache \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ca-certificates \
  ttf-freefont

# 复制文件
COPY --from=web-builder /app/web/node_modules ./node_modules
COPY --from=web-builder /app/web/package.json ./
COPY --from=web-builder /app/web/.next ./.next
COPY --from=web-builder /app/web/public ./public

# 确保 data 目录存在
RUN mkdir -p /app/web/data

ENV PLAYWRIGHT_BROWSERS_PATH=/usr/lib/chromium
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

EXPOSE 8080

# 直接使用 node 运行 next，设置正确的主机名
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0"]
