import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const categories = db.prepare(`
    SELECT category, COUNT(*) as count
    FROM bids
    GROUP BY category
    ORDER BY count DESC
  `).all();
  db.close();
  return NextResponse.json(categories);
}
