import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

// GET - Carica appuntamenti
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mese = searchParams.get('mese');
    const anno = searchParams.get('anno');

    let sql = 'SELECT * FROM appuntamenti';
    const params: any[] = [];

    if (mese && anno) {
      sql += ` WHERE EXTRACT(MONTH FROM data::date) = $1 AND EXTRACT(YEAR FROM data::date) = $2`;
      params.push(parseInt(mese), parseInt(anno));
    }

    sql += ' ORDER BY data, ora_inizio';

    const result = await query(sql, params);
    return NextResponse.json(result.rows || []);
  } catch (error) {
    console.error('Errore caricamento appuntamenti:', error);
    return NextResponse.json({ error: 'Errore caricamento appuntamenti' }, { status: 500 });
  }
}

// POST - Crea appuntamento
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { persona_id, sede_id, data, ora_inizio, ora_fine, cliente, note } = body;

    const result = await query(
      `INSERT INTO appuntamenti (persona_id, sede_id, data, ora_inizio, ora_fine, cliente, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [persona_id, sede_id, data, ora_inizio, ora_fine, cliente, note]
    );

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Errore creazione appuntamento:', error);
    return NextResponse.json({ error: 'Errore creazione appuntamento' }, { status: 500 });
  }
}
