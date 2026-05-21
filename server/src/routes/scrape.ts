import { FastifyInstance } from 'fastify';
import { getDb } from '../db/init.js';
import { runScraper } from '../../scraper/src/scraper.js';

export async function scrapeRouter(app: FastifyInstance) {
  // 手动触发爬取
  app.post('/run', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const category = body.category as string;
    const keywords = (body.keywords || '安全，等保，密评，云安全，天翼云，合规，风险评估') as string;
    const pages = parseInt((body.pages || '3') as string);

    try {
      const result = await runScraper({
        categories: category ? [category] : undefined,
        keywords: keywords.split('，').concat(keywords.split(',')),
        pages,
      });

      return {
        success: true,
        message: '爬取完成',
        result,
      };
    } catch (error) {
      console.error('Scrape error:', error);
      return reply.status(500).send({
        error: '爬取失败',
        message: error instanceof Error ? error.message : '未知错误',
      });
    }
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
      is_running: running.count > 0,
      last_completed: lastComplete || null,
    };
  });
}
