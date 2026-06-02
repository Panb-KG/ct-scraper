import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// 告诉 Next.js 这个路由是动态的，不要在构建时预渲染
export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getDb();
  try {
    const categories = db.prepare(`
      SELECT category, COUNT(*) as count
      FROM bids
      GROUP BY category
      ORDER BY count DESC
    `).all();
    return NextResponse.json(categories);
  } finally {
    db.close();
  }
}
