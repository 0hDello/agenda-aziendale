import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';


export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params; 
    const { nome } = await request.json();

    if (!nome || !nome.trim()) {
      return NextResponse.json({ error: 'Nome sede obbligatorio' }, { status: 400 });
    }

    const result = await query(
      'UPDATE sedi SET nome = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [nome.trim(), id] 
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Sede non trovata' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Errore aggiornamento sede:', error);
    return NextResponse.json({ error: 'Errore aggiornamento sede' }, { status: 500 });
  }
}


export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params; 
    const result = await query('DELETE FROM sedi WHERE id = $1 RETURNING *', [id]); 

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Sede non trovata' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Sede eliminata con successo' });
  } catch (error) {
    console.error('Errore eliminazione sede:', error);
    return NextResponse.json(
      { error: 'Impossibile eliminare: potrebbero esistere associazioni' },
      { status: 500 }
    );
  }
}
