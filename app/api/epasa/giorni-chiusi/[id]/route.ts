import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

// DELETE: rimuovi un giorno chiuso
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await query('DELETE FROM epasa_giorni_chiusi WHERE id = $1', [params.id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Errore eliminazione giorno chiuso:', error);
    return NextResponse.json({ error: 'Errore eliminazione' }, { status: 500 });
  }
}
