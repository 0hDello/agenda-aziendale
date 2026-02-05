import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { sede_id, operatore_id, data, ora, cliente, mese, note } = body;

    const result = await query(
      `UPDATE epasa_appuntamenti 
       SET sede_id = $1, operatore_id = $2, data = $3, ora = $4, 
           cliente = $5, mese = $6, note = $7, updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [sede_id, operatore_id, data, ora, cliente, mese, note || null, params.id]
    );

    if (result.rows && result.rows[0]) {
      const normalized = {
        ...result.rows[0],
        data: result.rows[0].data.split('T')[0],
        ora: typeof result.rows[0].ora === 'string' ? result.rows[0].ora.substring(0, 5) : result.rows[0].ora,
      };
      return NextResponse.json(normalized);
    }

    return NextResponse.json({ error: 'Appuntamento non trovato' }, { status: 404 });
  } catch (error) {
    console.error('Errore aggiornamento appuntamento EPASA:', error);
    return NextResponse.json({ error: 'Errore aggiornamento appuntamento' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await query('DELETE FROM epasa_appuntamenti WHERE id = $1', [params.id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Errore eliminazione appuntamento EPASA:', error);
    return NextResponse.json({ error: 'Errore eliminazione appuntamento' }, { status: 500 });
  }
}
