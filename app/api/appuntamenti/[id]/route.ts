import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { format } from 'date-fns';

// PUT - Aggiorna appuntamento
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> } //  CORRETTO: params è Promise
) {
  try {
    //  CORRETTO: Unwrap params con await
    const { id } = await params;
    
    const body = await request.json();
    const { persona_id, sede_id, ora_inizio, ora_fine, cliente, note } = body;

    // Validazione
    if (!persona_id || !sede_id || !ora_inizio || !ora_fine) {
      return NextResponse.json(
        { error: 'Tutti i campi obbligatori devono essere compilati' },
        { status: 400 }
      );
    }

    const result = await query(
      `UPDATE appuntamenti 
       SET persona_id = $1, sede_id = $2, ora_inizio = $3, ora_fine = $4, cliente = $5, note = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [persona_id, sede_id, ora_inizio, ora_fine, cliente || null, note || null, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Appuntamento non trovato' }, { status: 404 });
    }

    //  AGGIUNGI NORMALIZZAZIONE
    const normalized = {
      ...result.rows[0],
      data: result.rows[0].data instanceof Date 
        ? format(result.rows[0].data, 'yyyy-MM-dd') 
        : (typeof result.rows[0].data === 'string' 
          ? result.rows[0].data.split('T')[0] 
          : result.rows[0].data),
      ora_inizio: typeof result.rows[0].ora_inizio === 'string' 
        ? result.rows[0].ora_inizio.substring(0, 5) 
        : result.rows[0].ora_inizio,
      ora_fine: typeof result.rows[0].ora_fine === 'string' 
        ? result.rows[0].ora_fine.substring(0, 5) 
        : result.rows[0].ora_fine,
    };

    return NextResponse.json(normalized);
  } catch (error) {
    console.error('Errore aggiornamento appuntamento:', error);
    return NextResponse.json({ error: 'Errore aggiornamento appuntamento' }, { status: 500 });
  }
}

// DELETE - Elimina appuntamento
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> } //  CORRETTO: params è Promise
) {
  try {
    //  CORRETTO: Unwrap params con await
    const { id } = await params;
    
    const result = await query('DELETE FROM appuntamenti WHERE id = $1', [id]);
    
    // Verifica se è stato eliminato qualcosa
    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Appuntamento non trovato' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Errore eliminazione appuntamento:', error);
    return NextResponse.json({ error: 'Errore eliminazione appuntamento' }, { status: 500 });
  }
}
