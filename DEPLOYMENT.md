# CT-Scraper 部署指南

## 本地开发

```bash
# 安装依赖
cd server && npm install
cd ../web && npm install
cd ../scraper && npm install

# 启动开发服务器
npm run dev
```

## Zeabur 部署

### 1. 准备工作

- 注册 [Zeabur](https://zeabur.com) 账号
- 连接 GitHub 仓库

### 2. 创建项目

1. 在 Zeabur 控制台点击「新建项目」
2. 选择「从 GitHub 仓库导入」
3. 选择 `Panb-KG/ct-scraper` 仓库

### 3. 配置环境变量

在 Zeabur 项目设置中添加以下环境变量：

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `BAILIAN_API_KEY` | 阿里云 DashScope API Key | `sk-xxx` |
| `BAILIAN_API_URL` | AI API 端点 | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` |
| `NEXT_PUBLIC_API_URL` | 后端 API 地址 | `https://your-server.zeabur.app` |

### 4. 配置持久化存储

为 SQLite 数据库创建持久化卷：

```
路径: /app/server/data
大小: 1GB
```

### 5. 部署服务

Zeabur 会自动检测并部署：
- **Server**: Fastify API 服务 (端口 3001)
- **Web**: Next.js 前端 (端口 3000)

### 6. 配置爬虫定时任务

使用 Zeabur Cron 或外部定时服务定期运行爬虫：

```bash
# 手动触发爬虫
curl -X POST https://your-server.zeabur.app/api/scrape/run

# 或使用 cron 表达式
0 */6 * * * curl -X POST https://your-server.zeabur.app/api/scrape/run
```

## Docker 部署

### 构建镜像

```bash
docker build -t ct-scraper:latest .
```

### 运行容器

```bash
docker run -d \
  --name ct-scraper \
  -p 3000:3000 \
  -p 3001:3001 \
  -v $(pwd)/server/data:/app/server/data \
  -e BAILIAN_API_KEY=your_key \
  ct-scraper:latest
```

## 环境变量说明

### 必需变量

| 变量名 | 说明 |
|--------|------|
| `BAILIAN_API_KEY` | 阿里云 DashScope API Key |
| `BAILIAN_API_URL` | AI API 端点 |

### 可选变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `PORT` | Server 端口 | 3001 |
| `HOST` | Server 监听地址 | 0.0.0.0 |
| `NEXT_PUBLIC_API_URL` | 前端 API 地址 | http://localhost:3001 |

## 目录结构

```
ct-scraper/
├── scraper/          # 爬虫模块
├── server/           # 后端 API
├── web/              # 前端界面
├── Dockerfile        # Docker 构建配置
├── zeabur.json       # Zeabur 部署配置
└── README.md         # 项目文档
```

## 常见问题

### 1. 爬虫模块未启动

爬虫模块通过 API 触发，不是常驻服务。可以通过以下方式运行：
- API 调用: `POST /api/scrape/run`
- 命令行: `cd scraper && npm run scrape`

### 2. 数据库文件丢失

确保 `/app/server/data` 目录配置了持久化存储。

### 3. Playwright 浏览器未安装

Dockerfile 已包含 Chromium 安装，如果遇到问题可以手动安装：
```bash
npx playwright install --with-deps chromium
```

## 监控与维护

- 健康检查: `GET /api/health`
- 统计数据: `GET /api/stats`
- 爬取日志: `GET /api/scrape/logs`
