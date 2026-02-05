import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function GET() {
  try {
    const result = await query('SELECT * FROM epasa_operatori ORDER BY id');
    return NextResponse.json(result.rows || []);
  } catch (error) {
    console.error('Errore caricamento operatori EPASA:', error);
    return NextResponse.json({ error: 'Errore caricamento operatori' }, { status: 500 });
  }
}
