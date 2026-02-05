import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const result = await query(
      'SELECT * FROM room_appuntamenti WHERE id = $1',
      [params.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Appuntamento non trovato' },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Errore caricamento appuntamento sala:', error);
    return NextResponse.json(
      { error: 'Errore caricamento appuntamento sala' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { sala_id, data, ora_inizio, ora_fine, titolo, mese } = body;

    // Verifica se l'appuntamento esiste
    const existing = await query(
      'SELECT * FROM room_appuntamenti WHERE id = $1',
      [params.id]
    );

    if (existing.rows.length === 0) {
      return NextResponse.json(
        { error: 'Appuntamento non trovato' },
        { status: 404 }
      );
    }

    // Verifica conflitti orari (escludendo l'appuntamento corrente)
    if (sala_id && data && ora_inizio && ora_fine) {
      const conflictCheck = await query(
        `SELECT id FROM room_appuntamenti
         WHERE sala_id = $1 
         AND data = $2
         AND id != $5
         AND (
           (ora_inizio < $4 AND ora_fine > $3)
           OR (ora_inizio >= $3 AND ora_inizio < $4)
         )`,
        [sala_id, data, ora_inizio, ora_fine, params.id]
      );

      if (conflictCheck.rows.length > 0) {
        return NextResponse.json(
          { error: 'Conflitto orario: la sala è già occupata in questo orario' },
          { status: 409 }
        );
      }
    }

    // Prepara i campi da aggiornare
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (sala_id !== undefined) {
      updates.push(`sala_id = $${paramIndex++}`);
      values.push(sala_id);
    }
    if (data !== undefined) {
      updates.push(`data = $${paramIndex++}`);
      values.push(data);
    }
    if (ora_inizio !== undefined) {
      updates.push(`ora_inizio = $${paramIndex++}`);
      values.push(ora_inizio);
    }
    if (ora_fine !== undefined) {
      updates.push(`ora_fine = $${paramIndex++}`);
      values.push(ora_fine);
    }
    if (titolo !== undefined) {
      updates.push(`titolo = $${paramIndex++}`);
      values.push(titolo);
    }
    if (mese !== undefined) {
      updates.push(`mese = $${paramIndex++}`);
      values.push(mese);
    }

    updates.push(`updated_at = NOW()`);
    values.push(params.id);

    const result = await query(
      `UPDATE room_appuntamenti 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Errore aggiornamento appuntamento sala:', error);
    return NextResponse.json(
      { error: 'Errore aggiornamento appuntamento sala' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Verifica se l'appuntamento esiste
    const existing = await query(
      'SELECT * FROM room_appuntamenti WHERE id = $1',
      [params.id]
    );

    if (existing.rows.length === 0) {
      return NextResponse.json(
        { error: 'Appuntamento non trovato' },
        { status: 404 }
      );
    }

    await query('DELETE FROM room_appuntamenti WHERE id = $1', [params.id]);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Appuntamento eliminato con successo' 
    });
  } catch (error) {
    console.error('Errore eliminazione appuntamento sala:', error);
    return NextResponse.json(
      { error: 'Errore eliminazione appuntamento sala' },
      { status: 500 }
    );
  }
}
