import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { broadcastEpasaUpdate } from '@/lib/sse';
import { format } from 'date-fns';
import { logActivity } from '@/lib/log';

const normalizeApt = (apt: any) => ({
  ...apt,
  data: apt.data instanceof Date
    ? format(apt.data, 'yyyy-MM-dd')
    : apt.data.split('T')[0],
  ora: typeof apt.ora === 'string' ? apt.ora.substring(0, 5) : apt.ora,
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await query(
      'SELECT * FROM epasa_appuntamenti WHERE id = $1',
      [params.id]
    );
    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(normalizeApt(result.rows[0]));
  } catch (error) {
    console.error('Errore lettura appuntamento EPASA:', error);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { sede_id, operatore_id, data, ora, cliente, mese, note, highlight } = body;

    const result = await query(
      `UPDATE epasa_appuntamenti
       SET sede_id = $1, operatore_id = $2, data = $3, ora = $4,
           cliente = $5, mese = $6, note = $7, highlight = $8,
           updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        sede_id,
        operatore_id,
        data,
        ora,
        cliente,
        mese ?? null,
        note ?? null,
        highlight ?? null,
        params.id,
      ]
    );

    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const normalized = normalizeApt(result.rows[0]);

    broadcastEpasaUpdate('update', { action: 'update' });

    await logActivity({
      source: 'EPASA',
      action: 'UPDATE',
      descrizione: `Modificato appuntamento: ${cliente} — ${sede_id?.toUpperCase()} / ${operatore_id} — ${data} ${ora}`,
      dettagli: normalized,
    });

    return NextResponse.json(normalized);
  } catch (error) {
    console.error('Errore aggiornamento appuntamento EPASA:', error);
    return NextResponse.json({ error: 'Errore aggiornamento appuntamento' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await query(
      'DELETE FROM epasa_appuntamenti WHERE id = $1 RETURNING *',
      [params.id]
    );
    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const apt = result.rows[0];
    broadcastEpasaUpdate('update', { action: 'delete' });

    await logActivity({
      source: 'EPASA',
      action: 'DELETE',
      descrizione: `Eliminato appuntamento: ${apt.cliente} — ${apt.sede_id?.toUpperCase()} / ${apt.operatore_id} — ${apt.data}`,
      dettagli: apt,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Errore eliminazione appuntamento EPASA:', error);
    return NextResponse.json({ error: 'Errore eliminazione appuntamento' }, { status: 500 });
  }
}
