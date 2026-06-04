import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getDb();
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

  return NextResponse.json({
    ...stats,
    by_category: categoryStats,
  });
}
