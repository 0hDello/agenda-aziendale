import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

// PUT - Aggiorna appuntamento
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { persona_id, sede_id, ora_inizio, ora_fine, cliente, note } = body;

    const result = await query(
      `UPDATE appuntamenti 
       SET persona_id = $1, sede_id = $2, ora_inizio = $3, ora_fine = $4, cliente = $5, note = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [persona_id, sede_id, ora_inizio, ora_fine, cliente, note, params.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Appuntamento non trovato' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Errore aggiornamento appuntamento:', error);
    return NextResponse.json({ error: 'Errore aggiornamento appuntamento' }, { status: 500 });
  }
}

// DELETE - Elimina appuntamento
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await query('DELETE FROM appuntamenti WHERE id = $1', [params.id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Errore eliminazione appuntamento:', error);
    return NextResponse.json({ error: 'Errore eliminazione appuntamento' }, { status: 500 });
  }
}
