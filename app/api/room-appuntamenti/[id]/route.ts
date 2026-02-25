import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { format } from 'date-fns';
import { broadcastRoomUpdate } from '@/lib/sse';
import { logActivity } from '@/lib/log';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const result = await query(
      'SELECT * FROM room_appuntamenti WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Appuntamento non trovato' },
        { status: 404 }
      );
    }

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
    console.error('Errore caricamento appuntamento sala:', error);
    return NextResponse.json(
      { error: 'Errore caricamento appuntamento sala' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const body = await request.json();
    const { sala_id, data, ora_inizio, ora_fine, titolo, mese } = body;

    const existing = await query(
      'SELECT * FROM room_appuntamenti WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return NextResponse.json(
        { error: 'Appuntamento non trovato' },
        { status: 404 }
      );
    }

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
        [sala_id, data, ora_inizio, ora_fine, id]
      );

      if (conflictCheck.rows.length > 0) {
        return NextResponse.json(
          { error: 'Conflitto orario: la sala è già occupata in questo orario' },
          { status: 409 }
        );
      }
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (sala_id !== undefined) { updates.push(`sala_id = $${paramIndex++}`); values.push(sala_id); }
    if (data !== undefined) { updates.push(`data = $${paramIndex++}`); values.push(data); }
    if (ora_inizio !== undefined) { updates.push(`ora_inizio = $${paramIndex++}`); values.push(ora_inizio); }
    if (ora_fine !== undefined) { updates.push(`ora_fine = $${paramIndex++}`); values.push(ora_fine); }
    if (titolo !== undefined) { updates.push(`titolo = $${paramIndex++}`); values.push(titolo); }
    if (mese !== undefined) { updates.push(`mese = $${paramIndex++}`); values.push(mese); }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE room_appuntamenti 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

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

    broadcastRoomUpdate('update');

    const salaLabel = (sala_id || existing.rows[0].sala_id)?.toUpperCase();
    const titoloLabel = titolo || existing.rows[0].titolo;
    const dataLabel = data || (existing.rows[0].data instanceof Date ? format(existing.rows[0].data, 'yyyy-MM-dd') : String(existing.rows[0].data).split('T')[0]);
    const oraLabel = `${ora_inizio || existing.rows[0].ora_inizio}–${ora_fine || existing.rows[0].ora_fine}`;

    await logActivity({
      source: 'SALA_RIUNIONI',
      action: 'UPDATE',
      descrizione: `Modificata prenotazione: ${salaLabel} — «${titoloLabel}» — ${dataLabel} ${oraLabel}`,
      dettagli: { id, ...normalized },
    });

    return NextResponse.json(normalized);
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const existing = await query(
      'SELECT * FROM room_appuntamenti WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return NextResponse.json(
        { error: 'Appuntamento non trovato' },
        { status: 404 }
      );
    }

    const apt = existing.rows[0];
    await query('DELETE FROM room_appuntamenti WHERE id = $1', [id]);

    broadcastRoomUpdate('update');

    const dataStr = apt.data instanceof Date ? format(apt.data, 'yyyy-MM-dd') : String(apt.data).split('T')[0];
    const oraStr = `${typeof apt.ora_inizio === 'string' ? apt.ora_inizio.substring(0, 5) : apt.ora_inizio}–${typeof apt.ora_fine === 'string' ? apt.ora_fine.substring(0, 5) : apt.ora_fine}`;

    await logActivity({
      source: 'SALA_RIUNIONI',
      action: 'DELETE',
      descrizione: `Eliminata prenotazione: ${apt.sala_id?.toUpperCase()} — «${apt.titolo}» — ${dataStr} ${oraStr}`,
      dettagli: { id, ...apt },
    });

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
