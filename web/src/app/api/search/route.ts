import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('q') || '';
  const category = searchParams.get('category') || '';
  const startDate = searchParams.get('start_date') || '';
  const endDate = searchParams.get('end_date') || '';
  const buyer = searchParams.get('buyer') || '';
  const location = searchParams.get('location') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = (page - 1) * limit;

  const db = getDb();

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

  return NextResponse.json({
    data: results,
    query: { keyword, category, startDate, endDate, buyer, location },
  });
}
