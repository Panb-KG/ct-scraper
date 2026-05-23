import { FastifyInstance } from 'fastify';
import { getDb } from '../db/init.js';
import { spawn } from 'child_process';
import path from 'path';

// 全局锁，防止并发爬取
let isRunning = false;

export async function scrapeRouter(app: FastifyInstance) {
  // 手动触发爬取
  app.post('/run', async (request, reply) => {
    if (isRunning) {
      return reply.status(409).send({ error: '爬虫正在运行中，请稍后再试' });
    }

    const body = request.body as Record<string, unknown>;
    const keywords = (body.keywords as string) || '安全,等保,密评,云安全,天翼云,合规,风险评估';
    const pages = parseInt((body.pages as string) || '3');
    const category = (body.category as string) || '';
    const skipDetails = body.skipDetails === true || body.skipDetails === 'true';

    isRunning = true;

    // 记录日志
    const db = getDb();
    const logResult = db.prepare(`
      INSERT INTO scrape_logs (category, keyword, page_from, page_to, status)
      VALUES (?, ?, 1, ?, 'running')
    `).run(category || 'all', keywords, pages);
    const logId = logResult.lastInsertRowid as number;
    db.close();

    // 构建命令
    const scraperDir = path.resolve(process.cwd(), '../scraper');
    const args = ['tsx', 'src/index.ts', `--pages`, pages.toString(), `--keywords`, keywords];
    if (category) args.push('--category', category);
    if (skipDetails) args.push('--skip-details');

    const proc = spawn('npx', args, {
      cwd: scraperDir,
      stdio: 'pipe',
      env: { ...process.env },
    });

    let output = '';
    proc.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.log(`[scraper] ${text.trim()}`);
    });
    proc.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.error(`[scraper-err] ${text.trim()}`);
    });

    proc.on('close', (code) => {
      isRunning = false;
      const db = getDb();
      if (code === 0) {
        db.prepare(`
          UPDATE scrape_logs
          SET status = 'completed', records_found = 0, records_new = 0, finished_at = datetime('now')
          WHERE id = ?
        `).run(logId);
      } else {
        db.prepare(`
          UPDATE scrape_logs
          SET status = 'error', error_text = ?, finished_at = datetime('now')
          WHERE id = ?
        `).run(output.slice(-500), logId);
      }
      db.close();
    });

    return {
      success: true,
      message: '爬虫任务已启动',
      log_id: logId,
      pid: proc.pid,
    };
  });

  // 获取爬取日志
  app.get('/logs', async () => {
    const db = getDb();
    const logs = db.prepare(`
      SELECT * FROM scrape_logs
      ORDER BY started_at DESC
      LIMIT 50
    `).all();
    db.close();
    return logs;
  });

  // 获取爬取状态
  app.get('/status', async () => {
    const db = getDb();
    const running = db.prepare(`
      SELECT COUNT(*) as count FROM scrape_logs WHERE status = 'running'
    `).get() as { count: number };

    const lastComplete = db.prepare(`
      SELECT * FROM scrape_logs
      WHERE status = 'completed'
      ORDER BY finished_at DESC
      LIMIT 1
    `).get();

    db.close();

    return {
      is_running: isRunning || running.count > 0,
      last_completed: lastComplete || null,
    };
  });
}
