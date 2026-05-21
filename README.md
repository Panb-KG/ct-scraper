# CT-Scraper 招投标查询平台

中国电信阳光采购网招投标信息爬取与智能查询平台。

## 功能特性

- 🕷️ **自动爬取** - 基于 Playwright 的全自动爬虫，支持多分类、多关键词搜索
- 🔍 **多维度搜索** - 关键词、分类、时间、招标人、地区等组合查询
- 🤖 **AI 对话** - 基于 Qwen 大模型的智能问答，自然语言查询招投标信息
- 📧 **邮件订阅** - 定期推送匹配的招投标信息到邮箱
- 📊 **数据看板** - 实时统计爬取进度和数据分布
- 🚀 **Zeabur 部署** - 一键部署到云端

## 技术栈

| 模块 | 技术 |
|------|------|
| 爬虫 | Node.js + Playwright |
| 数据库 | SQLite (本地) / PostgreSQL (生产) |
| 后端 | Fastify + TypeScript |
| 前端 | Next.js 14 + TailwindCSS |
| AI | 阿里云 Qwen 大模型 |
| 部署 | Docker + Zeabur |

## 项目结构

```
ct-scraper/
├── scraper/          # 爬虫模块
│   ├── src/
│   │   ├── browser.ts      # Playwright 浏览器管理
│   │   ├── scraper.ts      # 核心爬取逻辑
│   │   └── config.ts       # 配置（分类、关键词、频率）
│   └── package.json
├── server/           # 后端 API
│   ├── src/
│   │   ├── db/
│   │   │   └── init.ts     # 数据库 Schema
│   │   ├── routes/
│   │   │   ├── bids.ts     # 招投标查询
│   │   │   ├── search.ts   # 多维度搜索
│   │   │   ├── chat.ts     # AI 对话
│   │   │   ├── subscribe.ts # 邮件订阅
│   │   │   └── scrape.ts   # 爬取控制
│   │   └── index.ts        # 入口
│   └── package.json
├── web/              # 前端查询界面
│   ├── src/app/
│   │   ├── page.tsx        # 首页
│   │   ├── search/page.tsx # 搜索页
│   │   ├── chat/page.tsx   # AI 对话页
│   │   └── subscribe/page.tsx # 订阅页
│   └── package.json
├── Dockerfile        # 部署配置
└── package.json      # Monorepo 根配置
```

## 快速开始

### 环境要求

- Node.js >= 20
- npm >= 10

### 安装依赖

```bash
# 根目录
npm install

# 爬虫模块
cd scraper && npm install

# 后端
cd server && npm install

# 前端
cd web && npm install
```

### 开发模式

```bash
# 启动所有服务（并发）
npm run dev

# 或分别启动
npm run dev:scraper
npm run dev:server
npm run dev:web
```

### 配置环境变量

创建 `.env` 文件：

```bash
# Server
PORT=3001
BAILIAN_API_KEY=your_api_key
BAILIAN_API_URL=https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions

# Web
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 运行爬虫

```bash
cd scraper
npm run scrape -- --keywords 安全，等保，密评 --pages 3
```

### 数据库

```bash
# 初始化数据库
npm run db:migrate

# 数据库文件位置
server/data/ct-scraper.db
```

## 部署

### Zeabur 部署

1. 推送代码到 GitHub
2. 在 Zeabur 创建新项目，关联此仓库
3. 配置环境变量
4. 自动部署

### Docker 部署

```bash
docker build -t ct-scraper .
docker run -p 3001:3001 ct-scraper
```

## 爬虫策略

- **频率控制**：每页 3-8 秒随机延迟，详情页 5-10 秒延迟
- **优先级**：先爬最新数据（第 1 页），历史数据逐步回溯
- **去重**：基于 detail_url 唯一性检查
- **反爬**：真实浏览器渲染，模拟人类操作节奏

## 许可证

MIT
