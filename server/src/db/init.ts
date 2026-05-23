import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'ct-scraper.db');

export function getDb(): Database.Database {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function initDb(): void {
  const db = getDb();

  // 确保列存在（兼容已有数据库）
  try { db.exec('ALTER TABLE bids ADD COLUMN province TEXT DEFAULT ""'); } catch { /* 列已存在 */ }

  db.exec(`
    -- 招投标列表数据
    CREATE TABLE IF NOT EXISTS bids (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id TEXT UNIQUE NOT NULL,          -- 来源网站原始 ID
      title TEXT NOT NULL,                      -- 标题
      category TEXT NOT NULL,                   -- 公告分类
      keywords TEXT DEFAULT '',                 -- 匹配关键词（逗号分隔）
      publish_date TEXT,                        -- 发布日期
      list_url TEXT,                            -- 列表页 URL
      detail_url TEXT,                          -- 详情页 URL
      summary TEXT DEFAULT '',                  -- 列表摘要
      province TEXT DEFAULT '',                 -- 省份
      status TEXT DEFAULT 'pending',            -- pending / scraped / error
      scraped_at TEXT,                          -- 抓取时间
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- 招投标详情数据
    CREATE TABLE IF NOT EXISTS bid_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bid_id INTEGER NOT NULL REFERENCES bids(id),
      content TEXT DEFAULT '',                  -- 详情全文（Markdown）
      buyer TEXT DEFAULT '',                    -- 招标人
      agency TEXT DEFAULT '',                   -- 代理机构
      budget TEXT DEFAULT '',                   -- 预算金额
      location TEXT DEFAULT '',                 -- 地区
      deadline TEXT,                            -- 截止时间
      raw_html TEXT DEFAULT '',                 -- 原始 HTML
      scraped_at TEXT,                          -- 抓取时间
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- 搜索索引视图（虚拟表）
    CREATE VIRTUAL TABLE IF NOT EXISTS bids_fts USING fts5(
      title, category, summary, content,
      content='bids',
      content_rowid='id'
    );

    -- 邮件订阅
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      keywords TEXT DEFAULT '',                 -- 订阅关键词
      categories TEXT DEFAULT '',               -- 订阅分类（逗号分隔）
      frequency TEXT DEFAULT 'daily',           -- daily / weekly
      is_active INTEGER DEFAULT 1,
      token TEXT UNIQUE,                        -- 订阅管理 token
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- 爬取任务日志
    CREATE TABLE IF NOT EXISTS scrape_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      keyword TEXT DEFAULT '',
      page_from INTEGER DEFAULT 1,
      page_to INTEGER,
      records_found INTEGER DEFAULT 0,
      records_new INTEGER DEFAULT 0,
      status TEXT DEFAULT 'running',            -- running / completed / error
      error_text TEXT,
      started_at TEXT DEFAULT (datetime('now')),
      finished_at TEXT
    );

    -- 索引
    CREATE INDEX IF NOT EXISTS idx_bids_category ON bids(category);
    CREATE INDEX IF NOT EXISTS idx_bids_status ON bids(status);
    CREATE INDEX IF NOT EXISTS idx_bids_publish_date ON bids(publish_date);
    CREATE INDEX IF NOT EXISTS idx_bids_detail_url ON bids(detail_url);
    CREATE INDEX IF NOT EXISTS idx_bid_details_bid_id ON bid_details(bid_id);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_email ON subscriptions(email);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_token ON subscriptions(token);
    CREATE INDEX IF NOT EXISTS idx_scrape_logs_status ON scrape_logs(status);
  `);

  db.close();
  console.log('Database initialized:', DB_PATH);
}

if (require.main === module) {
  initDb();
}
