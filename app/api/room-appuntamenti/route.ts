import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { format } from 'date-fns';

export async function GET() {
  try {
    const result = await query('SELECT * FROM room_appuntamenti ORDER BY data ASC, ora_inizio ASC');
    
    if (result.rows) {
      const normalized = result.rows.map(apt => ({
        ...apt,
        // ✅ CORRETTO: Normalizza la data in formato yyyy-MM-dd
        data: apt.data instanceof Date 
          ? format(apt.data, 'yyyy-MM-dd') 
          : (typeof apt.data === 'string' ? apt.data.split('T')[0] : apt.data),
        // ✅ CORRETTO: Normalizza l'ora
        ora_inizio: typeof apt.ora_inizio === 'string' 
          ? apt.ora_inizio.substring(0, 5) 
          : apt.ora_inizio,
        ora_fine: typeof apt.ora_fine === 'string' 
          ? apt.ora_fine.substring(0, 5) 
          : apt.ora_fine,
      }));
      return NextResponse.json(normalized);
    }
    
    return NextResponse.json([]);
  } catch (error) {
    console.error('Errore caricamento appuntamenti sale:', error);
    return NextResponse.json({ error: 'Errore caricamento appuntamenti' }, { status: 500 });
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

    if (result.rows && result.rows[0]) {
      const normalized = {
        ...result.rows[0],
        // ✅ CORRETTO: Normalizza la data in formato yyyy-MM-dd
        data: result.rows[0].data instanceof Date 
          ? format(result.rows[0].data, 'yyyy-MM-dd') 
          : (typeof result.rows[0].data === 'string' 
            ? result.rows[0].data.split('T')[0] 
            : result.rows[0].data),
        ora_inizio: typeof result.rows[0].ora_inizio === 'string' 
          ? result.rows[0].ora_inizio.substring(0, 5) 
          : result.rows[0].ora_inizio,
        ora_fine: typeof result.rows[0].ora_fine === 'string' 
          ? result.rows[0].ora_fine.substring(0, 5) 
          : result.rows[0].ora_fine,
      };
      return NextResponse.json(normalized, { status: 201 });
    }

    return NextResponse.json({ error: 'Errore creazione' }, { status: 500 });
  } catch (error) {
    console.error('Errore creazione appuntamento sala:', error);
    return NextResponse.json(
      { error: 'Errore creazione appuntamento sala' },
      { status: 500 }
    );
  }
}
