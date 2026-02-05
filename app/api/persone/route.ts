import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function GET() {
  try {
    const result = await query('SELECT * FROM persone ORDER BY nome');
    return NextResponse.json(result.rows || []);
  } catch (error) {
    console.error('Errore caricamento persone:', error);
    return NextResponse.json({ error: 'Errore caricamento persone' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { nome } = await request.json();

    if (!nome || !nome.trim()) {
      return NextResponse.json({ error: 'Nome persona obbligatorio' }, { status: 400 });
    }

    const result = await query(
      'INSERT INTO persone (nome) VALUES ($1) RETURNING *',
      [nome.trim()]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Errore creazione persona:', error);
    return NextResponse.json({ error: 'Errore creazione persona' }, { status: 500 });
  }
}
