import { FastifyInstance } from 'fastify';
import { getDb } from '../db/init.js';

export async function bidsRouter(app: FastifyInstance) {
  // 获取招投标列表（分页）
  app.get('/', async (request) => {
    const db = getDb();
    const query = request.query as Record<string, string>;
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const offset = (page - 1) * limit;
    const category = query.category || '';
    const keyword = query.keyword || '';

    let sql = 'SELECT * FROM bids WHERE 1=1';
    const params: (string | number)[] = [];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (keyword) {
      sql += ' AND (title LIKE ? OR summary LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY publish_date DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const bids = db.prepare(sql).all(...params);

    const countSql = 'SELECT COUNT(*) as total FROM bids WHERE 1=1';
    let countParams: (string | number)[] = [];
    let finalCountSql = countSql;
    if (category) {
      finalCountSql += ' AND category = ?';
      countParams.push(category);
    }
    if (keyword) {
      finalCountSql += ' AND (title LIKE ? OR summary LIKE ?)';
      countParams.push(`%${keyword}%`, `%${keyword}%`);
    }
    const { total } = db.prepare(finalCountSql).get(...countParams) as { total: number };

    db.close();

    return {
      data: bids,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  });

  // 获取单个招投标详情
  app.get('/:id', async (request) => {
    const params = request.params as Record<string, string>;
    const db = getDb();

    const bid = db.prepare('SELECT * FROM bids WHERE id = ?').get(params.id);
    if (!bid) {
      db.close();
      return { error: 'Not found' };
    }

    const detail = db.prepare('SELECT * FROM bid_details WHERE bid_id = ?').get(params.id);

    db.close();

    return {
      ...bid,
      detail: detail || null,
    };
  });

  // 获取所有分类
  app.get('/categories', async () => {
    const db = getDb();
    const categories = db.prepare(`
      SELECT category, COUNT(*) as count
      FROM bids
      GROUP BY category
      ORDER BY count DESC
    `).all();
    db.close();
    return categories;
  });
}
