import Fastify from 'fastify';
import cors from '@fastify/cors';
import { initDb } from './db/init.js';
import { bidsRouter } from './routes/bids.js';
import { searchRouter } from './routes/search.js';
import { chatRouter } from './routes/chat.js';
import { subscribeRouter } from './routes/subscribe.js';
import { scrapeRouter } from './routes/scrape.js';

const app = Fastify({
  logger: true,
  trustProxy: true,
});

async function main() {
  // 初始化数据库
  initDb();

  // 插件
  await app.register(cors, {
    origin: true,
  });

  // 路由
  await app.register(bidsRouter, { prefix: '/api/bids' });
  await app.register(searchRouter, { prefix: '/api/search' });
  await app.register(chatRouter, { prefix: '/api/chat' });
  await app.register(subscribeRouter, { prefix: '/api/subscribe' });
  await app.register(scrapeRouter, { prefix: '/api/scrape' });

  // 健康检查
  app.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // 统计信息
  app.get('/api/stats', async () => {
    const db = (await import('./db/init.js')).getDb();
    const stats = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM bids) as total_bids,
        (SELECT COUNT(*) FROM bids WHERE status = 'scraped') as scraped_bids,
        (SELECT COUNT(*) FROM bid_details) as total_details,
        (SELECT COUNT(*) FROM subscriptions WHERE is_active = 1) as active_subscriptions,
        (SELECT COUNT(*) FROM scrape_logs WHERE status = 'completed') as completed_scrapes
    `).get() as Record<string, number>;

    const categoryStats = db.prepare(`
      SELECT category, COUNT(*) as count
      FROM bids
      GROUP BY category
      ORDER BY count DESC
    `).all() as { category: string; count: number }[];

    db.close();

    return {
      ...stats,
      by_category: categoryStats,
    };
  });

  const port = parseInt(process.env.PORT || '3001');
  const host = process.env.HOST || '0.0.0.0';

  await app.listen({ port, host });
  console.log(`Server running at http://${host}:${port}`);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
