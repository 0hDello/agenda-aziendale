import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { broadcastEpasaUpdate } from '@/lib/sse';

// GET: ritorna tutti i giorni chiusi
export async function GET() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS epasa_giorni_chiusi (
        id SERIAL PRIMARY KEY,
        data DATE NOT NULL,
        operatore_id VARCHAR(50),
        motivo VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    const result = await query('SELECT * FROM epasa_giorni_chiusi ORDER BY data ASC');
    const rows = (result.rows || []).map((r: any) => ({
      ...r,
      data: r.data instanceof Date ? r.data.toISOString().split('T')[0] : r.data.toString().split('T')[0],
    }));
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Errore caricamento giorni chiusi:', error);
    return NextResponse.json({ error: 'Errore caricamento giorni chiusi' }, { status: 500 });
  }
}

// POST: aggiungi un giorno chiuso
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { data, operatore_id, motivo } = body;
    if (!data) {
      return NextResponse.json({ error: 'Data obbligatoria' }, { status: 400 });
    }
    await query(`
      CREATE TABLE IF NOT EXISTS epasa_giorni_chiusi (
        id SERIAL PRIMARY KEY,
        data DATE NOT NULL,
        operatore_id VARCHAR(50),
        motivo VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    const result = await query(
      'INSERT INTO epasa_giorni_chiusi (data, operatore_id, motivo) VALUES ($1, $2, $3) RETURNING *',
      [data, operatore_id || null, motivo || null]
    );
    const row = result.rows[0];

    // Notifica tutti i client SSE connessi
    broadcastEpasaUpdate('update', { action: 'giorno-chiuso' });

    return NextResponse.json({
      ...row,
      data: row.data instanceof Date ? row.data.toISOString().split('T')[0] : row.data.toString().split('T')[0],
    });
  } catch (error) {
    console.error('Errore aggiunta giorno chiuso:', error);
    return NextResponse.json({ error: 'Errore aggiunta giorno chiuso' }, { status: 500 });
  }
}
