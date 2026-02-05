import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function GET() {
  try {
    const result = await query('SELECT * FROM epasa_appuntamenti ORDER BY data ASC');
    
    if (result.rows) {
      const normalized = result.rows.map(apt => ({
        ...apt,
        data: apt.data.split('T')[0],
        ora: typeof apt.ora === 'string' ? apt.ora.substring(0, 5) : apt.ora,
      }));
      return NextResponse.json(normalized);
    }
    
    return NextResponse.json([]);
  } catch (error) {
    console.error('Errore caricamento appuntamenti EPASA:', error);
    return NextResponse.json({ error: 'Errore caricamento appuntamenti' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sede_id, operatore_id, data, ora, cliente, mese, note } = body;

    const result = await query(
      `INSERT INTO epasa_appuntamenti 
       (sede_id, operatore_id, data, ora, cliente, mese, note) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [sede_id, operatore_id, data, ora, cliente, mese, note || null]
    );

    if (result.rows && result.rows[0]) {
      const normalized = {
        ...result.rows[0],
        data: result.rows[0].data.split('T')[0],
        ora: typeof result.rows[0].ora === 'string' ? result.rows[0].ora.substring(0, 5) : result.rows[0].ora,
      };
      return NextResponse.json(normalized);
    }

    return NextResponse.json({ error: 'Errore creazione' }, { status: 500 });
  } catch (error) {
    console.error('Errore creazione appuntamento EPASA:', error);
    return NextResponse.json({ error: 'Errore creazione appuntamento' }, { status: 500 });
  }
}
