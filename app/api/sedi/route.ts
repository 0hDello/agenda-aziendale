import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function GET() {
  try {
    const result = await query('SELECT * FROM sedi ORDER BY nome');
    return NextResponse.json(result.rows || []);
  } catch (error) {
    console.error('Errore caricamento sedi:', error);
    return NextResponse.json({ error: 'Errore caricamento sedi' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { nome } = await request.json();

    if (!nome || !nome.trim()) {
      return NextResponse.json({ error: 'Nome sede obbligatorio' }, { status: 400 });
    }

    console.log('📤 Tentativo inserimento sede:', nome);

    const result = await query(
      'INSERT INTO sedi (nome) VALUES ($1) RETURNING *',
      [nome.trim()]
    );

    console.log('✅ Sede inserita:', result.rows[0]);

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('❌ Errore creazione sede:', error);
    return NextResponse.json({ error: 'Errore creazione sede' }, { status: 500 });
  }
}
