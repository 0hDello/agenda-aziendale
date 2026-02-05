import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const result = await query(
      'DELETE FROM persona_sede WHERE id = $1 RETURNING *',
      [params.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Associazione non trovata' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Associazione eliminata con successo' });
  } catch (error) {
    console.error('Errore eliminazione persona_sede:', error);
    return NextResponse.json({ error: 'Errore eliminazione associazione' }, { status: 500 });
  }
}
