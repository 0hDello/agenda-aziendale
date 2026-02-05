import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function GET() {
  try {
    const result = await query('SELECT * FROM room_appuntamenti ORDER BY data ASC, ora_inizio ASC');
    return NextResponse.json(result.rows || []);
  } catch (error) {
    console.error('Errore caricamento appuntamenti sale:', error);
    return NextResponse.json(
      { error: 'Errore caricamento appuntamenti sale' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sala_id, data, ora_inizio, ora_fine, titolo, mese } = body;

    // Validazione campi obbligatori
    if (!sala_id || !data || !ora_inizio || !ora_fine || !titolo) {
      return NextResponse.json(
        { error: 'Tutti i campi obbligatori devono essere compilati' },
        { status: 400 }
      );
    }

    // Verifica conflitti orari
    const conflictCheck = await query(
      `SELECT id FROM room_appuntamenti
       WHERE sala_id = $1 
       AND data = $2
       AND (
         (ora_inizio < $4 AND ora_fine > $3)
         OR (ora_inizio >= $3 AND ora_inizio < $4)
       )`,
      [sala_id, data, ora_inizio, ora_fine]
    );

    if (conflictCheck.rows.length > 0) {
      return NextResponse.json(
        { error: 'Conflitto orario: la sala è già occupata in questo orario' },
        { status: 409 }
      );
    }

    const result = await query(
      `INSERT INTO room_appuntamenti 
       (sala_id, data, ora_inizio, ora_fine, titolo, mese, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [sala_id, data, ora_inizio, ora_fine, titolo, mese]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Errore creazione appuntamento sala:', error);
    return NextResponse.json(
      { error: 'Errore creazione appuntamento sala' },
      { status: 500 }
    );
  }
}
