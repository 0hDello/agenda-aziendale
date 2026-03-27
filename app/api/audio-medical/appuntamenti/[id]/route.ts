import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { format } from 'date-fns';
import { broadcastAudioMedicalUpdate } from '@/lib/sse';
import { logActivity } from '@/lib/log';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { sede_id, data, ora, cliente, note, highlight } = body;

    const result = await query(
      `UPDATE audio_medical_appuntamenti
       SET sede_id = $1, data = $2, ora = $3, cliente = $4, note = $5, highlight = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [sede_id, data, ora, cliente, note || null, highlight || null, id],
    );

    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json({ error: 'Appuntamento non trovato' }, { status: 404 });
    }

    const normalized = {
      ...result.rows[0],
      data: result.rows[0].data instanceof Date
        ? format(result.rows[0].data, 'yyyy-MM-dd')
        : result.rows[0].data.split('T')[0],
      ora: typeof result.rows[0].ora === 'string'
        ? result.rows[0].ora.substring(0, 5)
        : result.rows[0].ora,
    };

    broadcastAudioMedicalUpdate('update', { action: 'update' });
    await logActivity({
      source: 'SCREENING',
      action: 'UPDATE',
      descrizione: `Modificato appuntamento screening: ${normalized.cliente} — ${normalized.data} ${normalized.ora}`,
      dettagli: { cliente: normalized.cliente, data: normalized.data, ora: normalized.ora, sede: normalized.sede_id, note: normalized.note },
    });
    return NextResponse.json(normalized);
  } catch (error) {
    console.error('Errore aggiornamento appuntamento Audio Medical:', error);
    return NextResponse.json({ error: 'Errore aggiornamento appuntamento' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const result = await query(
      'DELETE FROM audio_medical_appuntamenti WHERE id = $1 RETURNING *',
      [id],
    );

    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json({ error: 'Appuntamento non trovato' }, { status: 404 });
    }

    const deleted = result.rows[0];
    const dataStr = deleted.data instanceof Date ? format(deleted.data, 'yyyy-MM-dd') : String(deleted.data).split('T')[0];
    const oraStr  = typeof deleted.ora === 'string' ? deleted.ora.substring(0, 5) : deleted.ora;

    broadcastAudioMedicalUpdate('update', { action: 'delete' });
    await logActivity({
      source: 'SCREENING',
      action: 'DELETE',
      descrizione: `Eliminato appuntamento screening: ${deleted.cliente} — ${dataStr} ${oraStr}`,
      dettagli: { cliente: deleted.cliente, data: dataStr, ora: oraStr, sede: deleted.sede_id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Errore eliminazione appuntamento Audio Medical:', error);
    return NextResponse.json({ error: 'Errore eliminazione appuntamento' }, { status: 500 });
  }
}
