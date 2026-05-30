import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = (page - 1) * limit;
  const category = searchParams.get('category') || '';
  const keyword = searchParams.get('keyword') || '';

  const db = getDb();

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

  let countSql = 'SELECT COUNT(*) as total FROM bids WHERE 1=1';
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

  return NextResponse.json({
    data: bids,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}
