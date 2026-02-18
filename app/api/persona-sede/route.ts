import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function GET() {
  try {
    const result = await query('SELECT * FROM persona_sede ORDER BY created_at DESC');
    return NextResponse.json(result.rows || []);
  } catch (error) {
    console.error('Errore caricamento persona_sede:', error);
    return NextResponse.json({ error: 'Errore caricamento persona_sede' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { persona_id, sede_id } = await request.json();

    if (!persona_id || !sede_id) {
      return NextResponse.json(
        { error: 'persona_id e sede_id sono obbligatori' },
        { status: 400 }
      );
    }

    
    const existing = await query(
      'SELECT id FROM persona_sede WHERE persona_id = $1 AND sede_id = $2',
      [persona_id, sede_id]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: 'Questa associazione esiste già' },
        { status: 400 }
      );
    }

    const result = await query(
      'INSERT INTO persona_sede (persona_id, sede_id) VALUES ($1, $2) RETURNING *',
      [persona_id, sede_id]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Errore creazione persona_sede:', error);
    return NextResponse.json({ error: 'Errore creazione associazione' }, { status: 500 });
  }
}
