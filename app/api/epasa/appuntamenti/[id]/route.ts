import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { broadcastUpdate } from '@/lib/sse';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await pool.query(
      'SELECT * FROM epasa_appuntamenti WHERE id = $1',
      [params.id]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching appointment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { sede_id, operatore_id, data, ora, cliente, mese, note, highlight } = body;

    const result = await pool.query(
      `UPDATE epasa_appuntamenti
       SET sede_id = $1, operatore_id = $2, data = $3, ora = $4,
           cliente = $5, mese = $6, note = $7, highlight = $8
       WHERE id = $9
       RETURNING *`,
      [sede_id, operatore_id, data, ora, cliente, mese, note ?? null, highlight ?? null, params.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    broadcastUpdate();
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating appointment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await pool.query(
      'DELETE FROM epasa_appuntamenti WHERE id = $1 RETURNING *',
      [params.id]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    broadcastUpdate();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting appointment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
