import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { format } from 'date-fns';
import { broadcast730Update } from '@/lib/sse';


export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { persona_id, sede_id, ora_inizio, ora_fine, cliente, note, highlight } = body;

    if (!persona_id || !sede_id || !ora_inizio || !ora_fine) {
      return NextResponse.json(
        { error: 'Tutti i campi obbligatori devono essere compilati' },
        { status: 400 }
      );
    }

    const result = await query(
      `UPDATE appuntamenti
       SET persona_id = $1, sede_id = $2, ora_inizio = $3, ora_fine = $4,
           cliente = $5, note = $6, highlight = $7, updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [persona_id, sede_id, ora_inizio, ora_fine, cliente || null, note || null, highlight || null, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Appuntamento non trovato' }, { status: 404 });
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

    // Log in cronologia (solo appuntamenti reali, non UFF CHIUSO)
    if ((cliente ?? '').trim().toUpperCase() !== 'UFF CHIUSO') {
      try {
        await query(
          `INSERT INTO activity_log (source, action, descrizione, dettagli) VALUES ($1, $2, $3, $4)`,
          [
            'AGENDA_730',
            'UPDATE',
            `Appuntamento modificato: ${cliente || '(nessun cliente)'} – ${normalized.data} ${ora_inizio.substring(0,5)}-${ora_fine.substring(0,5)}`,
            JSON.stringify({ id, persona_id, sede_id, data: normalized.data, ora_inizio: ora_inizio.substring(0,5), ora_fine: ora_fine.substring(0,5), cliente: cliente || null, note: note || null }),
          ]
        );
      } catch { /* log non bloccante */ }
    }

    broadcast730Update();
    return NextResponse.json(normalized);
  } catch (error) {
    console.error('Errore aggiornamento appuntamento:', error);
    return NextResponse.json({ error: 'Errore aggiornamento appuntamento' }, { status: 500 });
  }
}


export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Recupera i dati prima di cancellare (per il log)
    const existing = await query('SELECT * FROM appuntamenti WHERE id = $1', [id]);
    const apt = existing.rows[0];

    const result = await query('DELETE FROM appuntamenti WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Appuntamento non trovato' },
        { status: 404 }
      );
    }

    // Log in cronologia (solo appuntamenti reali, non UFF CHIUSO)
    if (apt && (apt.cliente ?? '').trim().toUpperCase() !== 'UFF CHIUSO') {
      try {
        const dataStr = apt.data instanceof Date
          ? format(apt.data, 'yyyy-MM-dd')
          : (typeof apt.data === 'string' ? apt.data.split('T')[0] : String(apt.data));
        await query(
          `INSERT INTO activity_log (source, action, descrizione, dettagli) VALUES ($1, $2, $3, $4)`,
          [
            'AGENDA_730',
            'DELETE',
            `Appuntamento eliminato: ${apt.cliente || '(nessun cliente)'} – ${dataStr} ${String(apt.ora_inizio).substring(0,5)}-${String(apt.ora_fine).substring(0,5)}`,
            JSON.stringify({ id, persona_id: apt.persona_id, sede_id: apt.sede_id, data: dataStr, ora_inizio: String(apt.ora_inizio).substring(0,5), ora_fine: String(apt.ora_fine).substring(0,5), cliente: apt.cliente || null }),
          ]
        );
      } catch { /* log non bloccante */ }
    }

    broadcast730Update();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Errore eliminazione appuntamento:', error);
    return NextResponse.json({ error: 'Errore eliminazione appuntamento' }, { status: 500 });
  }
}
