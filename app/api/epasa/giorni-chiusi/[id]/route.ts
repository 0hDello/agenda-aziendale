import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

// DELETE: rimuovi un giorno chiuso
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await query('DELETE FROM epasa_giorni_chiusi WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Errore eliminazione giorno chiuso:', error);
    return NextResponse.json({ error: 'Errore eliminazione' }, { status: 500 });
  }
}
