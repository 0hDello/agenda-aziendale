import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function GET() {
  try {
    const result = await query('SELECT * FROM persona_sede');
    return NextResponse.json(result.rows || []);
  } catch (error) {
    console.error('Errore caricamento persona_sede:', error);
    return NextResponse.json({ error: 'Errore caricamento persona_sede' }, { status: 500 });
  }
}
