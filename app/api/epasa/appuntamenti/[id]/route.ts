import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { format } from 'date-fns';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> } // ✅ CORRETTO: params è Promise
) {
  try {
    // ✅ CORRETTO: Unwrap params con await
    const { id } = await params;
    
    const body = await request.json();
    const { sede_id, operatore_id, data, ora, cliente, mese, note } = body;

    // Validazione campi obbligatori
    if (!sede_id || !operatore_id || !data || !ora || !cliente) {
      return NextResponse.json(
        { error: 'Campi obbligatori mancanti' },
        { status: 400 }
      );
    }

    const result = await query(
      `UPDATE epasa_appuntamenti 
       SET sede_id = $1, operatore_id = $2, data = $3, ora = $4, 
           cliente = $5, mese = $6, note = $7, updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [sede_id, operatore_id, data, ora, cliente, mese || null, note || null, id]
    );

    if (result.rows && result.rows[0]) {
      const normalized = {
        ...result.rows[0],
        // ✅ CORRETTO: Gestisce sia Date che stringa
        data: result.rows[0].data instanceof Date 
          ? format(result.rows[0].data, 'yyyy-MM-dd') 
          : result.rows[0].data.split('T')[0],
        // ✅ CORRETTO: Gestisce ora come stringa o oggetto Time
        ora: typeof result.rows[0].ora === 'string' 
          ? result.rows[0].ora.substring(0, 5) 
          : result.rows[0].ora,
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
  { params }: { params: Promise<{ id: string }> } // ✅ CORRETTO: params è Promise
) {
  try {
    // ✅ CORRETTO: Unwrap params con await
    const { id } = await params;
    
    const result = await query('DELETE FROM epasa_appuntamenti WHERE id = $1', [id]);
    
    // Verifica se è stato eliminato qualcosa
    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Appuntamento non trovato' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Errore eliminazione appuntamento EPASA:', error);
    return NextResponse.json({ error: 'Errore eliminazione appuntamento' }, { status: 500 });
  }
}
