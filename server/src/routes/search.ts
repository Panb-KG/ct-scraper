import { FastifyInstance } from 'fastify';
import { getDb } from '../db/init.js';

export async function searchRouter(app: FastifyInstance) {
  // 多维度搜索
  app.get('/', async (request) => {
    const db = getDb();
    const query = request.query as Record<string, string>;
    const keyword = query.q || '';
    const category = query.category || '';
    const startDate = query.start_date || '';
    const endDate = query.end_date || '';
    const buyer = query.buyer || '';
    const location = query.location || '';
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const offset = (page - 1) * limit;

    // 使用 FTS5 全文搜索 + 条件过滤
    let sql = `
      SELECT b.*, bd.buyer, bd.location, bd.budget, bd.deadline
      FROM bids b
      LEFT JOIN bid_details bd ON b.id = bd.bid_id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (keyword) {
      // FTS5 全文搜索
      sql += ` AND b.id IN (
        SELECT bids.id FROM bids
        JOIN bids_fts ON bids.id = bids_fts.rowid
        WHERE bids_fts MATCH ?
      )`;
      params.push(keyword);
    }
    if (category) {
      sql += ' AND b.category = ?';
      params.push(category);
    }
    if (startDate) {
      sql += ' AND b.publish_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND b.publish_date <= ?';
      params.push(endDate);
    }
    if (buyer) {
      sql += ' AND bd.buyer LIKE ?';
      params.push(`%${buyer}%`);
    }
    if (location) {
      sql += ' AND bd.location LIKE ?';
      params.push(`%${location}%`);
    }

    sql += ' ORDER BY b.publish_date DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const results = db.prepare(sql).all(...params);

    db.close();

    return {
      data: results,
      query: { keyword, category, startDate, endDate, buyer, location },
    };
  });
}
