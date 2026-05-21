import { FastifyInstance } from 'fastify';
import { getDb } from '../db/init.js';
import crypto from 'crypto';

export async function subscribeRouter(app: FastifyInstance) {
  // 创建订阅
  app.post('/', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const email = body.email as string;
    const keywords = (body.keywords || '') as string;
    const categories = (body.categories || '') as string;
    const frequency = (body.frequency || 'daily') as string;

    if (!email || !email.includes('@')) {
      return reply.status(400).send({ error: '有效的邮箱地址是必需的' });
    }

    const db = getDb();
    const token = crypto.randomUUID();

    try {
      db.prepare(`
        INSERT INTO subscriptions (email, keywords, categories, frequency, token)
        VALUES (?, ?, ?, ?, ?)
      `).run(email, keywords, categories, frequency, token);

      db.close();

      return {
        success: true,
        message: '订阅已创建',
        token,
        manage_url: `/subscribe/manage?token=${token}`,
      };
    } catch (error) {
      db.close();
      return reply.status(500).send({ error: '创建订阅失败' });
    }
  });

  // 管理订阅（取消/更新）
  app.get('/manage', async (request) => {
    const query = request.query as Record<string, string>;
    const token = query.token || '';

    if (!token) {
      return { error: 'Token 是必需的' };
    }

    const db = getDb();
    const sub = db.prepare('SELECT * FROM subscriptions WHERE token = ?').get(token);
    db.close();

    if (!sub) {
      return { error: '订阅不存在' };
    }

    return sub;
  });

  // 取消订阅
  app.delete('/manage', async (request) => {
    const body = request.body as Record<string, unknown>;
    const token = body.token as string;

    const db = getDb();
    db.prepare('UPDATE subscriptions SET is_active = 0 WHERE token = ?').run(token);
    db.close();

    return { success: true, message: '已取消订阅' };
  });

  // 更新订阅
  app.patch('/manage', async (request) => {
    const body = request.body as Record<string, unknown>;
    const token = body.token as string;
    const keywords = body.keywords as string;
    const categories = body.categories as string;
    const frequency = body.frequency as string;

    const db = getDb();
    db.prepare(`
      UPDATE subscriptions
      SET keywords = COALESCE(?, keywords),
          categories = COALESCE(?, categories),
          frequency = COALESCE(?, frequency),
          updated_at = datetime('now')
      WHERE token = ?
    `).run(keywords, categories, frequency, token);
    db.close();

    return { success: true, message: '订阅已更新' };
  });
}
