import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function GET() {
  try {
    // Crea la tabella se non esiste ancora
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

    const result = await query(
      'SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 500'
    );

    return NextResponse.json(result.rows || []);
  } catch (error) {
    console.error('Errore caricamento cronologia:', error);
    return NextResponse.json({ error: 'Errore caricamento cronologia' }, { status: 500 });
  }
}
