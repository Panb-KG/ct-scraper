import { chromium, Browser } from 'playwright';
import path from 'path';
import fs from 'fs';

// ============ 配置 ============
const CONFIG = {
  BASE_URL: 'https://caigou.chinatelecom.com.cn',
  API_URL: 'https://caigou.chinatelecom.com.cn/portal/base/announcementJoin/queryListNew',
  CATEGORIES: [
    { name: '资格预审公告', type: 'e2np' },
    { name: '招标公告', type: 'e2no' },
    { name: '询比公告', type: 'e2nn' },
    { name: '谈判采购公告', type: 'e2nq' },
    { name: '拍卖公告', type: 'e2nr' },
    { name: '政企合作招募公告', type: 'e2ns' },
  ],
  PAGE_SIZE: 20,
  DELAY_BASE: 3000,    // 基础延迟 3s
  DELAY_JITTER: 5000,  // 随机抖动 0-5s
  PAGE_SIZE_LIMIT: 100, // 全量模式每页最大条数
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getDelay(): number {
  return CONFIG.DELAY_BASE + Math.random() * CONFIG.DELAY_JITTER;
}

// ============ 数据库 ============
function getDb() {
  const dbPath = path.resolve(__dirname, '../../server/data/ct-scraper.db');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new (require('better-sqlite3'))(dbPath);
  db.pragma('journal_mode = WAL');
  return db;
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

/**
 * 爬取单个分类的单页
 * 返回 { records, total, pages }
 */
async function fetchPage(
  browser: Browser,
  categoryType: string,
  page: number
): Promise<{ records: ApiRecord[]; total: number; pages: number }> {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const apiPage = await context.newPage();

  // 先访问首页获取 cookie
  await apiPage.goto(CONFIG.BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(1000);

  const requestBody = {
    pageNum: page,
    pageSize: CONFIG.PAGE_SIZE,
    type: categoryType,
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
    { url: CONFIG.API_URL, body: requestBody }
  );

  await context.close();

  const data = (response as Record<string, unknown>).data as Record<string, unknown> | undefined;
  const pageInfo = data?.pageInfo as Record<string, unknown> | undefined;
  const records = (pageInfo?.list as ApiRecord[]) || [];
  const total = (pageInfo?.total as number) || 0;
  const pages = Math.ceil(total / CONFIG.PAGE_SIZE);

  return { records, total, pages };
}

/**
 * 保存记录到 bids 表，返回 { found, new }
 */
function saveRecords(records: ApiRecord[], category: string): { found: number; new: number } {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO bids (source_id, title, category, publish_date, detail_url, province)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let newCount = 0;
  for (const row of records) {
    const detailUrl = `${CONFIG.BASE_URL}/DeclareDetails?id=${row.id}&type=1&docTypeCode=${row.docTypeCode}&securityViewCode=${row.securityViewCode}`;
    const result = stmt.run(row.id, row.docTitle, category, row.createDate, detailUrl, row.provinceName || '');
    if (result.changes > 0) newCount++;
  }

  const foundCount = records.length;
  db.close();
  return { found: foundCount, new: newCount };
}

// ============ 详情页爬取 ============
async function scrapeDetail(browser: Browser, detailUrl: string) {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  });
  const page = await context.newPage();

  try {
    await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1000);

    const content = await page.evaluate(() => {
      const selectors = ['.detail-content', '.article-content', '#content', '.main-content', '.content', 'article', '.detail'];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent?.trim().length > 100) return el.textContent?.trim() || '';
      }
      return document.body?.innerText?.trim() || '';
    });

    const fields = await page.evaluate(() => {
      const text = document.body?.innerText || '';
      const result: Record<string, string> = {};
      const patterns: [string, string][] = [
        ['buyer', '(?:招标人|采购人|业主)[：:\\s]*([^\\n]{2,40})'],
        ['agency', '(?:代理机构|招标代理)[：:\\s]*([^\\n]{2,50})'],
        ['budget', '(?:预算金额|预算|采购预算|最高限价)[：:\\s]*([^\\n]{2,30})'],
        ['location', '(?:项目地点|实施地点|地区)[：:\\s]*([^\\n]{2,30})'],
        ['deadline', '(?:截止时间|递交截止|开标时间)[：:\\s]*([^\\n]{2,30})'],
      ];
      for (const [key, pat] of patterns) {
        const m = text.match(new RegExp(pat));
        if (m) result[key] = m[1].trim();
      }
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
  } catch {
    await context.close().catch(() => {});
    return null;
  }
}

// ============ 任务管理 ============
interface TaskConfig {
  taskType: 'full_site' | 'incremental' | 'detail';
  categories?: string[];
  maxPages?: number;  // 增量模式用
}

/**
 * 创建爬取任务
 */
function createTask(config: TaskConfig): number {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO scrape_tasks (task_type, status, config_json)
    VALUES (?, 'queued', ?)
  `).run(config.taskType, JSON.stringify(config));
  const taskId = result.lastInsertRowid as number;
  db.close();
  return taskId;
}

/**
 * 探测每个分类的总页数（通过抓第1页获取 total）
 */
async function probeTotalPages(browser: Browser): Promise<{ category: string; type: string; total: number; pages: number }[]> {
  const results: { category: string; type: string; total: number; pages: number }[] = [];
  for (const cat of CONFIG.CATEGORIES) {
    try {
      const result = await fetchPage(browser, cat.type, 1);
      results.push({ category: cat.name, type: cat.type, total: result.total, pages: result.pages });
      await sleep(getDelay());
    } catch {
      results.push({ category: cat.name, type: cat.type, total: 0, pages: 0 });
    }
  }
  return results;
}

/**
 * 为任务生成 scrape_items（待抓取的页码）
 */
function generateItems(taskId: number, categoryPages: { category: string; type: string; pages: number }[]) {
  const db = getDb();
  const insertStmt = db.prepare(`
    INSERT INTO scrape_items (task_id, category, page_num)
    VALUES (?, ?, ?)
  `);

  const insertMany = db.transaction((items: [number, string, number][]) => {
    for (const item of items) insertStmt.run(...item);
  });

  const itemsToInsert: [number, string, number][] = [];
  for (const cp of categoryPages) {
    for (let p = 1; p <= cp.pages; p++) {
      itemsToInsert.push([taskId, cp.category, p]);
    }
  }

  if (itemsToInsert.length > 0) insertMany(itemsToInsert);

  // 更新任务总量
  db.prepare(`
    UPDATE scrape_tasks SET total_items = ? WHERE id = ?
  `).run(itemsToInsert.length, taskId);

  db.close();
}

/**
 * 为增量任务生成 scrape_items（每个分类只抓第1页）
 */
function generateIncrementalItems(taskId: number, categories: string[]) {
  const db = getDb();
  for (const cat of categories) {
    db.prepare(`
      INSERT INTO scrape_items (task_id, category, page_num)
      VALUES (?, ?, 1)
    `).run(taskId, cat);
  }
  db.prepare(`
    UPDATE scrape_tasks SET total_items = ? WHERE id = ?
  `).run(categories.length, taskId);
  db.close();
}

// ============ 主流程 ============
export async function runScraperWithTask(taskId: number): Promise<void> {
  const db = getDb();
  const task = db.prepare('SELECT * FROM scrape_tasks WHERE id = ?').get(taskId) as {
    id: number;
    task_type: string;
    status: string;
    config_json: string;
  };
  db.close();

  if (!task || task.status !== 'queued') {
    console.error(`任务 ${taskId} 不存在或状态不是 queued`);
    return;
  }

  const config: TaskConfig = JSON.parse(task.config_json);

  // 标记为 running
  const d = getDb();
  d.prepare(`
    UPDATE scrape_tasks SET status = 'running', started_at = datetime('now') WHERE id = ?
  `).run(taskId);
  d.close();

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    if (config.taskType === 'full_site') {
      await runFullSite(browser, taskId);
    } else if (config.taskType === 'incremental') {
      await runIncremental(browser, taskId);
    } else if (config.taskType === 'detail') {
      await runDetails(browser, taskId);
    }

    // 标记完成
    const d2 = getDb();
    d2.prepare(`
      UPDATE scrape_tasks
      SET status = 'completed', finished_at = datetime('now'),
          progress_pct = 100
      WHERE id = ?
    `).run(taskId);
    d2.close();

  } catch (err) {
    const d2 = getDb();
    d2.prepare(`
      UPDATE scrape_tasks
      SET status = 'failed', error_msg = ?, finished_at = datetime('now')
      WHERE id = ?
    `).run(err instanceof Error ? err.message.slice(0, 500) : 'unknown', taskId);
    d2.close();
  } finally {
    await browser.close();
  }
}

/**
 * 全量抓取：遍历所有分类的所有页码
 */
async function runFullSite(browser: Browser, taskId: number) {
  console.log('[全量] 探测各分类总页数...');
  const pageInfos = await probeTotalPages(browser);

  const db = getDb();
  db.prepare(`
    UPDATE scrape_tasks SET total_items = ? WHERE id = ?
  `).run(pageInfos.reduce((sum, p) => sum + p.pages, 0), taskId);
  db.close();

  // 生成所有 item
  generateItems(taskId, pageInfos.map(p => ({ category: p.category, type: p.type, pages: p.pages })));

  // 逐页抓取
  for (const pi of pageInfos) {
    console.log(`[全量] ${pi.category}: 共 ${pi.pages} 页, ${pi.total} 条`);
    if (pi.pages === 0) continue;

    for (let pageNum = 1; pageNum <= pi.pages; pageNum++) {
      await fetchAndSavePage(browser, taskId, pi.category, pi.type, pageNum);
    }
  }
}

/**
 * 增量抓取：每个分类只抓第1页（最新公告）
 */
async function runIncremental(browser: Browser, taskId: number) {
  const categories = CONFIG.CATEGORIES.map(c => c.name);
  generateIncrementalItems(taskId, categories);

  for (const cat of categories) {
    const catConfig = CONFIG.CATEGORIES.find(c => c.name === cat);
    if (!catConfig) continue;

    console.log(`[增量] ${cat}: 抓取第1页`);
    await fetchAndSavePage(browser, taskId, cat, catConfig.type, 1);
  }
}

/**
 * 详情页抓取
 */
async function runDetails(browser: Browser, taskId: number) {
  const db = getDb();
  const pending = db.prepare(`
    SELECT id, detail_url FROM bids
    WHERE status = 'pending' AND detail_url IS NOT NULL AND detail_url != ''
    ORDER BY created_at DESC
    LIMIT 200
  `).all() as { id: number; detail_url: string }[];

  db.prepare(`UPDATE scrape_tasks SET total_items = ? WHERE id = ?`).run(pending.length, taskId);
  db.close();

  console.log(`[详情] 待抓取: ${pending.length} 条`);

  let successCount = 0;
  for (const bid of pending) {
    const detail = await scrapeDetail(browser, bid.detail_url);
    if (detail) {
      const d = getDb();
      d.prepare(`UPDATE bids SET status = 'scraped', scraped_at = datetime('now') WHERE id = ?`).run(bid.id);
      d.prepare(`
        INSERT OR REPLACE INTO bid_details (bid_id, content, buyer, agency, budget, location, deadline, scraped_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(bid.id, detail.content, detail.buyer, detail.agency, detail.budget, detail.location, detail.deadline);

      try {
        d.prepare(`
          INSERT OR REPLACE INTO bids_fts (rowid, title, category, summary, content)
          SELECT id, title, category, summary, ? FROM bids WHERE id = ?
        `).run(detail.content, bid.id);
      } catch { /* FTS may not be ready */ }

      d.close();
      successCount++;
    }

    // 更新任务进度
    const d2 = getDb();
    d2.prepare(`
      UPDATE scrape_tasks SET completed_items = ?, success_count = ?,
        progress_pct = CASE WHEN total_items > 0 THEN ROUND(completed_items * 100.0 / total_items, 1) ELSE 100 END
      WHERE id = ?
    `).run(successCount, successCount, taskId);
    d2.close();

    await sleep(getDelay());
  }
}

/**
 * 抓取并保存单个页码
 */
async function fetchAndSavePage(
  browser: Browser,
  taskId: number,
  category: string,
  categoryType: string,
  pageNum: number
) {
  const db = getDb();
  // 标记为 fetching
  db.prepare(`
    UPDATE scrape_items SET status = 'fetching'
    WHERE task_id = ? AND category = ? AND page_num = ?
  `).run(taskId, category, pageNum);
  db.close();

  try {
    const result = await fetchPage(browser, categoryType, pageNum);
    const { found, new: newCount } = saveRecords(result.records, category);

    const d = getDb();
    d.prepare(`
      UPDATE scrape_items
      SET status = 'success', records_found = ?, records_new = ?, finished_at = datetime('now')
      WHERE task_id = ? AND category = ? AND page_num = ?
    `).run(found, newCount, taskId, category, pageNum);

    // 更新任务进度
    const completed = d.prepare(`
      SELECT COUNT(*) as cnt FROM scrape_items
      WHERE task_id = ? AND status IN ('success', 'failed', 'skipped')
    `).get(taskId) as { cnt: number };

    const successTotal = d.prepare(`
      SELECT COALESCE(SUM(records_new), 0) as cnt FROM scrape_items WHERE task_id = ?
    `).get(taskId) as { cnt: number };

    d.prepare(`
      UPDATE scrape_tasks
      SET completed_items = ?, success_count = ?,
        progress_pct = CASE WHEN total_items > 0 THEN ROUND(completed_items * 100.0 / total_items, 1) ELSE 100 END
      WHERE id = ?
    `).run(completed.cnt, successTotal.cnt, taskId);

    d.close();
    console.log(`  ${category} 第${pageNum}页: ${found}条(新${newCount}条)`);

  } catch (err) {
    const d = getDb();
    d.prepare(`
      UPDATE scrape_items
      SET status = 'failed', error_msg = ?, retry_count = retry_count + 1, finished_at = datetime('now')
      WHERE task_id = ? AND category = ? AND page_num = ?
    `).run(err instanceof Error ? err.message.slice(0, 200) : 'unknown', taskId, category, pageNum);

    const completed = d.prepare(`
      SELECT COUNT(*) as cnt FROM scrape_items
      WHERE task_id = ? AND status IN ('success', 'failed', 'skipped')
    `).get(taskId) as { cnt: number };

    d.prepare(`
      UPDATE scrape_tasks SET completed_items = ?,
        progress_pct = CASE WHEN total_items > 0 THEN ROUND(completed_items * 100.0 / total_items, 1) ELSE 100 END
      WHERE id = ?
    `).run(completed.cnt, taskId);
    d.close();
    console.error(`  ${category} 第${pageNum}页 失败:`, err instanceof Error ? err.message : 'unknown');
  }

  await sleep(getDelay());
}
