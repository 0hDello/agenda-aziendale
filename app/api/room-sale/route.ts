import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function GET() {
  try {
    const result = await query('SELECT * FROM room_sale ORDER BY id');
    return NextResponse.json(result.rows || []);
  } catch (error) {
    console.error('Errore caricamento sale:', error);
    return NextResponse.json({ error: 'Errore caricamento sale' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, nome, colore } = body;

    if (!id || !nome) {
      return NextResponse.json(
        { error: 'ID e nome sono obbligatori' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO room_sale (id, nome, colore, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING *`,
      [id, nome, colore || '#6B7280']
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Errore creazione sala:', error);
    return NextResponse.json({ error: 'Errore creazione sala' }, { status: 500 });
  }
}
