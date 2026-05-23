import Database from 'better-sqlite3';
import { chromium, Browser, Page } from 'playwright';
import path from 'path';
import fs from 'fs';

// ============ 配置 ============
const CONFIG = {
  BASE_URL: 'https://caigou.chinatelecom.com.cn',
  API_URL: 'https://caigou.chinatelecom.com.cn/portal/base/announcementJoin/queryListNew',
  // type 值是从页面 JS 中观察到的分类代码
  CATEGORIES: [
    { name: '资格预审公告', type: 'e2np' },
    { name: '招标公告', type: 'e2no' },
    { name: '询比公告', type: 'e2nn' },
    { name: '谈判采购公告', type: 'e2nq' },
    { name: '拍卖公告', type: 'e2nr' },
    { name: '政企合作招募公告', type: 'e2ns' },
  ],
  DEFAULT_KEYWORDS: ['安全', '等保', '密评', '云安全', '天翼云', '合规', '风险评估'],
  DEFAULT_PAGES: 3,
  PAGE_SIZE: 20,
  DELAY_MIN: 2000,
  DELAY_MAX: 5000,
  DB_PATH: path.resolve(__dirname, '../../server/data/ct-scraper.db'),
};

function getDelay(): number {
  return CONFIG.DELAY_MIN + Math.random() * (CONFIG.DELAY_MAX - CONFIG.DELAY_MIN);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============ 数据库 ============
function getDb(): Database.Database {
  const dir = path.dirname(CONFIG.DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new Database(CONFIG.DB_PATH);
  db.pragma('journal_mode = WAL');
  return db;
}

function initDb(): void {
  const db = getDb();

  // 兼容已有数据库：添加缺失列
  try { db.exec('ALTER TABLE bids ADD COLUMN province TEXT DEFAULT ""'); } catch { /* 已存在 */ }

  db.exec(`
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
    CREATE VIRTUAL TABLE IF NOT EXISTS bids_fts USING fts5(
      title, category, summary, content,
      content='bids', content_rowid='id'
    );
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
    CREATE INDEX IF NOT EXISTS idx_bids_category ON bids(category);
    CREATE INDEX IF NOT EXISTS idx_bids_status ON bids(status);
    CREATE INDEX IF NOT EXISTS idx_bids_publish_date ON bids(publish_date);
    CREATE INDEX IF NOT EXISTS idx_bids_detail_url ON bids(detail_url);
  `);
  db.close();
  console.log('Database initialized:', CONFIG.DB_PATH);
}

// ============ API 爬取（列表页） ============
interface ApiRecord {
  id: string;
  docTitle: string;
  docType: string;
  docTypeCode: string;
  createDate: string;
  provinceName: string;
  provinceCode: string;
  securityViewCode: string;
  [key: string]: unknown;
}

interface ApiResult {
  records: ApiRecord[];
  total: number;
  pages: number;
  current: number;
  size: number;
}

async function fetchPage(
  browser: Browser,
  category: string,
  keyword: string,
  page: number
): Promise<ApiResult> {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const apiPage = await context.newPage();

  // 先访问首页获取 cookie
  await apiPage.goto(CONFIG.BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(1000);

  const catConfig = CONFIG.CATEGORIES.find(c => c.name === category) || CONFIG.CATEGORIES[0];

  // 实际 API 格式: { pageNum, pageSize, type }
  const requestBody = {
    pageNum: page,
    pageSize: CONFIG.PAGE_SIZE,
    type: catConfig.type,
  };

  const response = await apiPage.evaluate(
    async ({ url, body }) => {
      const resp = await fetch(url as string, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return resp.json();
    },
    {
      url: CONFIG.API_URL,
      body: requestBody,
    }
  );

  await context.close();

  // 响应结构: { code: 200, data: { pageInfo: { total, list } } }
  const data = (response as Record<string, unknown>).data as Record<string, unknown> | undefined;
  const pageInfo = data?.pageInfo as Record<string, unknown> | undefined;
  const records = (pageInfo?.list as ApiRecord[]) || [];
  const total = (pageInfo?.total as number) || 0;
  const pages = Math.ceil(total / CONFIG.PAGE_SIZE);

  return {
    records,
    total,
    pages,
    current: page,
    size: CONFIG.PAGE_SIZE,
  };
}

async function saveRecords(
  records: ApiRecord[],
  category: string,
  keyword: string
): Promise<number> {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO bids (source_id, title, category, keywords, publish_date, detail_url, summary, province)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let newCount = 0;
  for (const row of records) {
    const detailUrl = `${CONFIG.BASE_URL}/DeclareDetails?id=${row.id}&type=1&docTypeCode=${row.docTypeCode}&securityViewCode=${row.securityViewCode}`;

    const result = stmt.run(
      row.id,
      row.docTitle,
      category,
      keyword,
      row.createDate,
      detailUrl,
      '',
      row.provinceName || ''
    );
    if (result.changes > 0) newCount++;
  }

  db.close();
  return newCount;
}

// ============ 详情页爬取 ============
async function scrapeDetail(browser: Browser, bidId: number, detailUrl: string): Promise<{
  content: string;
  buyer: string;
  agency: string;
  budget: string;
  location: string;
  deadline: string;
} | null> {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  });
  const page = await context.newPage();

  try {
    await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1000);

    // 提取正文
    const content = await page.evaluate(() => {
      // 尝试常见内容选择器
      const selectors = [
        '.detail-content',
        '.article-content',
        '#content',
        '.main-content',
        '.content',
        'article',
        '.detail',
        '.b-detail',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent?.trim().length > 100) {
          return el.textContent?.trim() || '';
        }
      }
      // 回退
      return document.body?.innerText?.trim() || '';
    });

    // 提取结构化字段
    const fields = await page.evaluate(() => {
      const text = document.body?.innerText || '';
      const result: Record<string, string> = {};

      const buyerMatch = text.match(/(?:招标人|采购人|业主)[：:\s]*([^\n]{2,40})/);
      if (buyerMatch) result.buyer = buyerMatch[1].trim();

      const agencyMatch = text.match(/(?:代理机构|招标代理)[：:\s]*([^\n]{2,50})/);
      if (agencyMatch) result.agency = agencyMatch[1].trim();

      const budgetMatch = text.match(/(?:预算金额|预算|采购预算|最高限价)[：:\s]*([^\n]{2,30})/);
      if (budgetMatch) result.budget = budgetMatch[1].trim();

      const locationMatch = text.match(/(?:项目地点|实施地点|地区)[：:\s]*([^\n]{2,30})/);
      if (locationMatch) result.location = locationMatch[1].trim();

      const deadlineMatch = text.match(/(?:截止时间|递交截止|开标时间)[：:\s]*([^\n]{2,30})/);
      if (deadlineMatch) result.deadline = deadlineMatch[1].trim();

      return result;
    });

    await context.close();

    return {
      content: content.slice(0, 20000),
      buyer: fields.buyer || '',
      agency: fields.agency || '',
      budget: fields.budget || '',
      location: fields.location || '',
      deadline: fields.deadline || '',
    };
  } catch (err) {
    console.error(`  详情页抓取失败 ${bidId}:`, err instanceof Error ? err.message : 'unknown');
    await context.close().catch(() => {});
    return null;
  }
}

// ============ 主流程 ============
interface ScrapeOptions {
  categories?: string[];
  keywords?: string[];
  pages?: number;
  skipDetails?: boolean;
}

export async function runScraper(options: ScrapeOptions = {}): Promise<void> {
  initDb();

  const categories = options.categories || CONFIG.CATEGORIES.map(c => c.name);
  const keywords = options.keywords || CONFIG.DEFAULT_KEYWORDS;
  const maxPages = options.pages || CONFIG.DEFAULT_PAGES;
  const skipDetails = options.skipDetails || false;

  console.log(`开始爬取 - 分类: ${categories.length} 个, 关键词: ${keywords.length} 个, 每类 ${maxPages} 页`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let totalNew = 0;
  let totalErrors = 0;

  try {
    for (const category of categories) {
      console.log(`\n[${category}] 开始...`);

      for (const keyword of keywords) {
        console.log(`  关键词: ${keyword}`);

        for (let page = 1; page <= maxPages; page++) {
          try {
            const result = await fetchPage(browser, category, keyword, page);
            console.log(`    第 ${page} 页: ${result.records.length} 条 (共 ${result.total} 条)`);

            if (result.records.length === 0) break;

            const newCount = await saveRecords(result.records, category, keyword);
            totalNew += newCount;
            console.log(`    新增: ${newCount} 条`);

            await sleep(getDelay());

            if (page >= result.pages) break;
          } catch (err) {
            console.error(`    错误: ${err instanceof Error ? err.message : 'unknown'}`);
            totalErrors++;
            break;
          }
        }

        await sleep(getDelay());
      }
    }

    console.log(`\n列表爬取完成 - 新增 ${totalNew} 条, 错误 ${totalErrors} 个`);

    // 爬取详情页
    if (!skipDetails) {
      console.log('\n开始爬取详情页...');
      const db = getDb();
      const pending = db.prepare(`
        SELECT id, detail_url FROM bids
        WHERE status = 'pending' AND detail_url IS NOT NULL AND detail_url != ''
        LIMIT 30
      `).all() as { id: number; detail_url: string }[];
      db.close();

      console.log(`  待爬取: ${pending.length} 个`);

      let detailOk = 0;
      for (const bid of pending) {
        try {
          const detail = await scrapeDetail(browser, bid.id, bid.detail_url);
          if (detail) {
            const d = getDb();
            d.prepare(`UPDATE bids SET status = 'scraped', scraped_at = datetime('now') WHERE id = ?`).run(bid.id);
            d.prepare(`
              INSERT INTO bid_details (bid_id, content, buyer, agency, budget, location, deadline, raw_html, scraped_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, '', datetime('now'))
            `).run(bid.id, detail.content, detail.buyer, detail.agency, detail.budget, detail.location, detail.deadline);

            // 更新 FTS
            try {
              d.prepare(`
                INSERT OR REPLACE INTO bids_fts (rowid, title, category, summary, content)
                SELECT id, title, category, summary, ? FROM bids WHERE id = ?
              `).run(detail.content, bid.id);
            } catch { /* FTS may not be ready */ }

            d.close();
            detailOk++;
          }
          await sleep(getDelay());
        } catch (err) {
          console.error(`  详情页 ${bid.id} 失败:`, err instanceof Error ? err.message : 'unknown');
        }
      }

      console.log(`  详情页完成: ${detailOk}/${pending.length}`);
    }
  } finally {
    await browser.close();
  }

  console.log('\n全部完成!');
}

// ============ CLI ============
// initDb is called inside runScraper

const args = process.argv.slice(2);
const opts: ScrapeOptions = { pages: 3, skipDetails: false };

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--keywords' && args[i + 1]) {
    opts.keywords = args[i + 1].split(/[,，]/);
    i++;
  } else if (args[i] === '--pages' && args[i + 1]) {
    opts.pages = parseInt(args[i + 1]);
    i++;
  } else if (args[i] === '--category' && args[i + 1]) {
    opts.categories = [args[i + 1]];
    i++;
  } else if (args[i] === '--skip-details') {
    opts.skipDetails = true;
  }
}

runScraper(opts).catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
