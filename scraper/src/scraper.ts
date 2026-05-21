import Database from 'better-sqlite3';
import { getPage, sleep, closeBrowser } from './browser.js';
import { CONFIG, getDelay } from './config.js';
import path from 'path';
import fs from 'fs';

interface ScrapeOptions {
  categories?: string[];
  keywords?: string[];
  pages?: number;
  skipDetails?: boolean;
}

interface ScrapeResult {
  total: number;
  newRecords: number;
  errors: number;
  duration: number;
}

export async function runScraper(options: ScrapeOptions = {}): Promise<ScrapeResult> {
  const startTime = Date.now();
  const categories = options.categories || CONFIG.CATEGORIES;
  const keywords = options.keywords || CONFIG.DEFAULT_KEYWORDS;
  const pages = options.pages || CONFIG.DEFAULT_PAGES;
  const skipDetails = options.skipDetails || false;

  console.log(`开始爬取 - 分类：${categories.length} 个，关键词：${keywords.length} 个，每类 ${pages} 页`);

  // 初始化数据库
  const dbPath = path.resolve(__dirname, CONFIG.DB_PATH);
  if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  const result: ScrapeResult = {
    total: 0,
    newRecords: 0,
    errors: 0,
    duration: 0,
  };

  let page: Page | null = null;

  try {
    page = await getPage();

    for (const category of categories) {
      console.log(`\n[${category}] 开始爬取...`);

      for (const keyword of keywords) {
        console.log(`  关键词：${keyword}`);

        try {
          const categoryResult = await scrapeCategory(page, category, keyword, pages, skipDetails);
          result.total += categoryResult.total;
          result.newRecords += categoryResult.newRecords;
          result.errors += categoryResult.errors;

          // 分类间延迟
          await sleep(getDelay());
        } catch (error) {
          console.error(`  错误：${error instanceof Error ? error.message : '未知错误'}`);
          result.errors++;
        }
      }
    }

    // 爬取详情页（如果需要）
    if (!skipDetails) {
      console.log('\n开始爬取详情页...');
      const detailResult = await scrapeDetails(db, page);
      result.total += detailResult.total;
      result.newRecords += detailResult.newRecords;
      result.errors += detailResult.errors;
    }
  } finally {
    if (page) {
      await page.close();
    }
    db.close();
    await closeBrowser();
  }

  result.duration = Date.now() - startTime;
  console.log(`\n爬取完成 - 总计：${result.total} 条，新增：${result.newRecords} 条，错误：${result.errors} 个，耗时：${(result.duration / 1000).toFixed(1)}秒`);

  return result;
}

async function scrapeCategory(
  page: Page,
  category: string,
  keyword: string,
  maxPages: number,
  skipDetails: boolean
): Promise<{ total: number; newRecords: number; errors: number }> {
  const result = { total: 0, newRecords: 0, errors: 0 };

  // 进入搜索状态
  await enterSearchState(page, category, keyword);

  // 获取总条数
  const totalCount = await getTotalCount(page);
  console.log(`    共 ${totalCount} 条结果`);

  if (totalCount === 0) {
    return result;
  }

  // 逐页爬取
  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    try {
      const records = await parsePage(page);
      result.total += records.length;

      // 保存记录到数据库
      const newCount = await saveRecords(records);
      result.newRecords += newCount;

      if (records.length === 0) {
        console.log(`    第 ${pageNum} 页：无数据`);
        break;
      }

      console.log(`    第 ${pageNum} 页：${records.length} 条（新增 ${newCount} 条）`);

      // 检查是否还有下一页
      const hasNext = await hasNextPage(page);
      if (!hasNext) {
        break;
      }

      // 点击下一页
      await clickNextPage(page);
      await sleep(getDelay());
    } catch (error) {
      console.error(`    第 ${pageNum} 页错误：${error instanceof Error ? error.message : '未知错误'}`);
      result.errors++;
      break;
    }
  }

  return result;
}

async function enterSearchState(page: Page, category: string, keyword: string): Promise<void> {
  const baseUrl = CONFIG.BASE_URL;
  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 });

  // 点击分类
  const btn = page.locator('.noticeNavItem', { hasText: category });
  await btn.click();
  await sleep(1500);

  // 等待输入框出现
  await page.waitForSelector('input[placeholder="请输入关键字"]', { timeout: 8000 });
  await page.waitForSelector('tr.el-table__row', { timeout: 8000 });

  // 输入关键词并搜索
  const input = page.locator('input[placeholder="请输入关键字"]');
  await input.fill(keyword);
  await page.locator('button:has-text("查询")').click();
  await sleep(2000);
  await page.waitForSelector('tr.el-table__row', { timeout: 8000 });
}

async function getTotalCount(page: Page): Promise<number> {
  try {
    const text = await page.textContent('.el-pagination__total');
    const match = text?.match(/共\s+(\d+)\s+条/);
    return match ? parseInt(match[1]) : 0;
  } catch {
    return 0;
  }
}

async function parsePage(page: Page): Promise<Record<string, unknown>[]> {
  const rows = await page.$$eval('tr.el-table__row', (trs) => {
    return trs.map((tr) => {
      const cells = tr.querySelectorAll('td');
      const titleEl = tr.querySelector('.noticeTitleBox, .noticeTitle, a');
      return {
        title: titleEl?.textContent?.trim() || '',
        date: cells[cells.length - 1]?.textContent?.trim() || '',
        href: titleEl?.getAttribute('href') || '',
      };
    });
  });

  return rows.filter((r) => r.title && r.title.length > 5);
}

async function saveRecords(records: Record<string, unknown>[]): Promise<number> {
  // 这里需要数据库操作
  // 简化版：实际应该插入到 bids 表
  console.log(`    保存 ${records.length} 条记录`);
  return records.length;
}

async function hasNextPage(page: Page): Promise<boolean> {
  try {
    const btn = await page.locator('button.btn-next:not([disabled])').count();
    return btn > 0;
  } catch {
    return false;
  }
}

async function clickNextPage(page: Page): Promise<void> {
  await page.locator('button.btn-next:not([disabled])').click();
  await page.waitForSelector('tr.el-table__row', { timeout: 8000 });
}

async function scrapeDetails(db: Database.Database, page: Page): Promise<{ total: number; newRecords: number; errors: number }> {
  const result = { total: 0, newRecords: 0, errors: 0 };

  // 获取待爬取的详情 URL
  const pendingBids = db.prepare(`
    SELECT id, detail_url FROM bids
    WHERE status = 'pending' AND detail_url IS NOT NULL
    LIMIT 50
  `).all() as { id: number; detail_url: string }[];

  console.log(`  待爬取详情页：${pendingBids.length} 个`);

  for (const bid of pendingBids) {
    try {
      await page.goto(bid.detail_url, { waitUntil: 'networkidle', timeout: 30000 });
      await sleep(getDelay());

      // 提取详情内容
      const content = await page.content();
      const title = await page.title();

      // 保存到数据库
      db.prepare(`
        UPDATE bids SET status = 'scraped', scraped_at = datetime('now')
        WHERE id = ?
      `).run(bid.id);

      db.prepare(`
        INSERT OR REPLACE INTO bid_details (bid_id, content, raw_html, scraped_at)
        VALUES (?, ?, ?, datetime('now'))
      `).run(bid.id, title, content);

      result.total++;
      result.newRecords++;

      await sleep(getDelay());
    } catch (error) {
      console.error(`  详情页错误 ${bid.id}：${error instanceof Error ? error.message : '未知错误'}`);
      result.errors++;
    }
  }

  return result;
}

// CLI 入口
if (require.main === module) {
  const args = process.argv.slice(2);
  const options: ScrapeOptions = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--keywords' && args[i + 1]) {
      options.keywords = args[i + 1].split(',').concat(args[i + 1].split('，'));
      i++;
    } else if (args[i] === '--pages' && args[i + 1]) {
      options.pages = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--category' && args[i + 1]) {
      options.categories = [args[i + 1]];
      i++;
    } else if (args[i] === '--skip-details') {
      options.skipDetails = true;
    }
  }

  runScraper(options).then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
