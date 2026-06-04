import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const db = getDb();

  const bid = db.prepare('SELECT * FROM bids WHERE id = ?').get(id);
  if (!bid) {
    db.close();
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const detail = db.prepare('SELECT * FROM bid_details WHERE bid_id = ?').get(id);

  db.close();

  return NextResponse.json({
    ...bid,
    detail: detail || null,
  });
}
