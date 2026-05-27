import { FastifyInstance } from 'fastify';
import { getDb } from '../db/init.js';
import { spawn } from 'child_process';
import path from 'path';

// 全局锁，防止并发爬取
let isRunning = false;
let currentTaskId: number | null = null;

export async function scrapeRouter(app: FastifyInstance) {
  // ============ 任务创建 ============

  // 启动全量抓取
  app.post('/tasks/full', async (request, reply) => {
    if (isRunning) return reply.status(409).send({ error: '爬虫正在运行中' });

    const taskId = createTask('full_site');
    return launchTask(taskId);
  });

  // 启动增量抓取（每天跑）
  app.post('/tasks/incremental', async (request, reply) => {
    if (isRunning) return reply.status(409).send({ error: '爬虫正在运行中' });

    const taskId = createTask('incremental');
    return launchTask(taskId);
  });

  // 启动详情页抓取
  app.post('/tasks/detail', async (request, reply) => {
    if (isRunning) return reply.status(409).send({ error: '爬虫正在运行中' });

    const taskId = createTask('detail');
    return launchTask(taskId);
  });

  // ============ 任务查询 ============

  // 获取所有任务列表
  app.get('/tasks', async () => {
    const db = getDb();
    const tasks = db.prepare(`
      SELECT * FROM scrape_tasks
      ORDER BY created_at DESC
      LIMIT 100
    `).all();
    db.close();
    return tasks;
  });

  // 获取单个任务详情 + 进度
  app.get('/tasks/:id', async (request, reply) => {
    const taskId = parseInt((request.params as Record<string, string>).id);
    const db = getDb();
    const task = db.prepare('SELECT * FROM scrape_tasks WHERE id = ?').get(taskId);
    if (!task) {
      db.close();
      return reply.status(404).send({ error: '任务不存在' });
    }

    // 各分类进度
    const byCategory = db.prepare(`
      SELECT category,
             COUNT(*) as total_pages,
             SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_pages,
             SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_pages,
             SUM(records_found) as records_found,
             SUM(records_new) as records_new
      FROM scrape_items
      WHERE task_id = ?
      GROUP BY category
      ORDER BY category
    `).all(taskId);

    // 最近完成的 item
    const recentItems = db.prepare(`
      SELECT category, page_num, status, records_found, records_new, finished_at
      FROM scrape_items
      WHERE task_id = ? AND status IN ('success', 'failed')
      ORDER BY finished_at DESC
      LIMIT 20
    `).all(taskId);

    db.close();
    return { task, by_category: byCategory, recent_items: recentItems };
  });

  // 获取当前运行状态
  app.get('/status', async () => {
    const db = getDb();
    const runningTask = db.prepare(`
      SELECT * FROM scrape_tasks WHERE status = 'running' ORDER BY started_at DESC LIMIT 1
    `).get();
    db.close();

    return {
      is_running: isRunning,
      current_task_id: currentTaskId,
      running_task: runningTask || null,
    };
  });

  // ============ 数据统计 ============

  // 数据库统计
  app.get('/stats', async () => {
    const db = getDb();

    const total = db.prepare('SELECT COUNT(*) as cnt FROM bids').get() as { cnt: number };
    const scraped = db.prepare("SELECT COUNT(*) as cnt FROM bids WHERE status = 'scraped'").get() as { cnt: number };
    const pending = db.prepare("SELECT COUNT(*) as cnt FROM bids WHERE status = 'pending'").get() as { cnt: number };

    const byCategory = db.prepare(`
      SELECT category, COUNT(*) as count
      FROM bids GROUP BY category ORDER BY count DESC
    `).all() as { category: string; count: number }[];

    const recentDates = db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM bids
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 7
    `).all() as { date: string; count: number }[];

    const lastTask = db.prepare(`
      SELECT * FROM scrape_tasks
      WHERE status IN ('completed', 'failed')
      ORDER BY finished_at DESC LIMIT 1
    `).get();

    db.close();

    return {
      total_bids: total.cnt,
      scraped: scraped.cnt,
      pending: pending.cnt,
      by_category: byCategory,
      recent_daily: recentDates,
      last_full_scrape: lastTask || null,
    };
  });

  // ============ 数据浏览 ============

  // 分页查询 bids
  app.get('/bids', async (request) => {
    const query = request.query as Record<string, string>;
    const page = parseInt(query.page || '1');
    const pageSize = Math.min(parseInt(query.pageSize || '20'), 100);
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.category) {
      conditions.push('category = ?');
      params.push(query.category);
    }
    if (query.status) {
      conditions.push('status = ?');
      params.push(query.status);
    }
    if (query.keyword) {
      conditions.push('(title LIKE ? OR summary LIKE ?)');
      params.push(`%${query.keyword}%`, `%${query.keyword}%`);
    }
    if (query.dateFrom) {
      conditions.push('publish_date >= ?');
      params.push(query.dateFrom);
    }
    if (query.dateTo) {
      conditions.push('publish_date <= ?');
      params.push(query.dateTo);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const db = getDb();
    const total = db.prepare(`SELECT COUNT(*) as cnt FROM bids ${where}`).get(...params) as { cnt: number };
    const bids = db.prepare(`
      SELECT id, source_id, title, category, publish_date, province, status, scraped_at, created_at, detail_url
      FROM bids ${where}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);
    db.close();

    return {
      data: bids,
      pagination: {
        page,
        pageSize,
        total: total.cnt,
        totalPages: Math.ceil(total.cnt / pageSize),
      },
    };
  });

  // 获取单条详情
  app.get('/bids/:id', async (request, reply) => {
    const bidId = parseInt((request.params as Record<string, string>).id);
    const db = getDb();
    const bid = db.prepare('SELECT * FROM bids WHERE id = ?').get(bidId);
    if (!bid) {
      db.close();
      return reply.status(404).send({ error: '记录不存在' });
    }
    const detail = db.prepare('SELECT * FROM bid_details WHERE bid_id = ?').get(bidId);
    db.close();
    return { bid, detail };
  });

  // 旧版兼容：手动触发爬取（关键词模式）
  app.post('/run', async (request, reply) => {
    if (isRunning) return reply.status(409).send({ error: '爬虫正在运行中' });

    const body = request.body as Record<string, unknown>;
    const keywords = (body.keywords as string) || '安全,等保,密评';
    const pages = parseInt((body.pages as string) || '3');
    const category = (body.category as string) || '';

    isRunning = true;

    const db = getDb();
    const logResult = db.prepare(`
      INSERT INTO scrape_logs (category, keyword, page_from, page_to, status)
      VALUES (?, ?, 1, ?, 'running')
    `).run(category || 'all', keywords, pages);
    const logId = logResult.lastInsertRowid as number;
    db.close();

    const scraperDir = path.resolve(process.cwd(), '../scraper');
    const args = ['tsx', 'src/index.ts', '--pages', pages.toString(), '--keywords', keywords];
    if (category) args.push('--category', category);

    const proc = spawn('npx', args, {
      cwd: scraperDir,
      stdio: 'pipe',
      env: { ...process.env },
    });

    proc.on('close', () => {
      isRunning = false;
    });

    return { success: true, message: '爬虫任务已启动', log_id: logId };
  });

  // 旧版兼容：获取日志
  app.get('/logs', async () => {
    const db = getDb();
    const logs = db.prepare('SELECT * FROM scrape_logs ORDER BY started_at DESC LIMIT 50').all();
    db.close();
    return logs;
  });
}

// ============ 辅助函数 ============

function createTask(taskType: string): number {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO scrape_tasks (task_type, status, config_json)
    VALUES (?, 'queued', ?)
  `).run(taskType, JSON.stringify({ taskType }));
  const taskId = result.lastInsertRowid as number;
  db.close();
  return taskId;
}

function launchTask(taskId: number) {
  currentTaskId = taskId;
  isRunning = true;

  const scraperDir = path.resolve(process.cwd(), '../scraper');
  const args = ['tsx', 'src/index.ts', '--task', taskId.toString()];

  const proc = spawn('npx', args, {
    cwd: scraperDir,
    stdio: 'pipe',
    env: { ...process.env },
  });

  proc.stdout.on('data', (data) => console.log(`[scraper] ${data.toString().trim()}`));
  proc.stderr.on('data', (data) => console.error(`[scraper-err] ${data.toString().trim()}`));

  proc.on('close', () => {
    isRunning = false;
    currentTaskId = null;
  });

  return {
    success: true,
    message: '爬虫任务已启动',
    task_id: taskId,
    pid: proc.pid,
  };
}
