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
    -- 爬取任务
    CREATE TABLE IF NOT EXISTS scrape_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_type TEXT NOT NULL,           -- full_site | incremental | detail
      status TEXT DEFAULT 'queued',      -- queued | running | completed | failed | paused
      total_items INTEGER DEFAULT 0,     -- 预计总量（页码数）
      completed_items INTEGER DEFAULT 0, -- 已完成数
      success_count INTEGER DEFAULT 0,   -- 成功抓取的条数
      fail_count INTEGER DEFAULT 0,      -- 失败条数
      progress_pct REAL DEFAULT 0,       -- 百分比 0-100
      started_at TEXT,
      finished_at TEXT,
      error_msg TEXT,
      config_json TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- 爬取明细（每页一个 item）
    CREATE TABLE IF NOT EXISTS scrape_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES scrape_tasks(id),
      category TEXT NOT NULL,
      page_num INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',     -- pending | fetching | success | failed | skipped
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      error_msg TEXT,
      records_found INTEGER DEFAULT 0,
      records_new INTEGER DEFAULT 0,
      finished_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_scrape_items_task ON scrape_items(task_id);
    CREATE INDEX IF NOT EXISTS idx_scrape_items_status ON scrape_items(task_id, status);

    -- 招投标列表数据
    CREATE TABLE IF NOT EXISTS bids (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      keywords TEXT DEFAULT '',
      publish_date TEXT,
      list_url TEXT,
      detail_url TEXT,
      summary TEXT DEFAULT '',
      province TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      scraped_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- 招投标详情数据
    CREATE TABLE IF NOT EXISTS bid_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bid_id INTEGER NOT NULL REFERENCES bids(id),
      content TEXT DEFAULT '',
      buyer TEXT DEFAULT '',
      agency TEXT DEFAULT '',
      budget TEXT DEFAULT '',
      location TEXT DEFAULT '',
      deadline TEXT,
      raw_html TEXT DEFAULT '',
      scraped_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- 搜索索引
    CREATE VIRTUAL TABLE IF NOT EXISTS bids_fts USING fts5(
      title, category, summary, content,
      content='bids',
      content_rowid='id'
    );

    -- 邮件订阅
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      keywords TEXT DEFAULT '',
      categories TEXT DEFAULT '',
      frequency TEXT DEFAULT 'daily',
      is_active INTEGER DEFAULT 1,
      token TEXT UNIQUE,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- 爬取任务日志（旧版，兼容保留）
    CREATE TABLE IF NOT EXISTS scrape_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      keyword TEXT DEFAULT '',
      page_from INTEGER DEFAULT 1,
      page_to INTEGER,
      records_found INTEGER DEFAULT 0,
      records_new INTEGER DEFAULT 0,
      status TEXT DEFAULT 'running',
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

// 构建阶段跳过数据库初始化（避免 SQLITE_BUSY）
// 运行时由 server 端 initDb() 负责初始化
if (process.env.NEXT_PHASE !== 'build') {
  initDb();
}
