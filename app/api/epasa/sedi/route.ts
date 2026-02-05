import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function GET() {
  try {
    const result = await query('SELECT * FROM epasa_sedi ORDER BY id');
    return NextResponse.json(result.rows || []);
  } catch (error) {
    console.error('Errore caricamento sedi EPASA:', error);
    return NextResponse.json({ error: 'Errore caricamento sedi' }, { status: 500 });
  }
}
