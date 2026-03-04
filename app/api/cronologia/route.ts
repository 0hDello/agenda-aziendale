import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

const LIMIT = 50;

export async function GET(req: NextRequest) {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id SERIAL PRIMARY KEY,
        source VARCHAR(50) NOT NULL,
        action VARCHAR(20) NOT NULL,
        descrizione TEXT NOT NULL,
        dettagli JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, parseInt(searchParams.get('page')   || '1'));
    const source = searchParams.get('source') || 'ALL';
    const action = searchParams.get('action') || 'ALL';
    const search = searchParams.get('q')      || '';
    const offset = (page - 1) * LIMIT;

    const conditions: string[] = [];
    const params: unknown[]    = [];
    let   idx = 1;

    if (source !== 'ALL') {
      conditions.push(`source = $${idx++}`);
      params.push(source);
    }
    if (action !== 'ALL') {
      conditions.push(`action = $${idx++}`);
      params.push(action);
    }
    if (search.trim()) {
      conditions.push(`descrizione ILIKE $${idx++}`);
      params.push(`%${search.trim()}%`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM activity_log ${where}`,
      params
    );
    const total      = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.max(1, Math.ceil(total / LIMIT)); // ← AGGIUNTO

    const dataResult = await query(
      `SELECT * FROM activity_log ${where} ORDER BY created_at DESC LIMIT ${LIMIT} OFFSET $${idx}`,
      [...params, offset] // ← LIMIT e OFFSET come parametri sicuri
    );

    return NextResponse.json({
      data:       dataResult.rows || [],
      total,
      totalPages, // ← AGGIUNTO
      page,
      limit:      LIMIT,
      hasMore:    offset + LIMIT < total,
    });
  } catch (error) {
    console.error('Errore caricamento cronologia:', error);
    return NextResponse.json({ error: 'Errore caricamento cronologia' }, { status: 500 });
  }
}
