import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { format } from 'date-fns';

export async function GET() {
  try {
    const result = await query('SELECT * FROM epasa_note_pomeriggio ORDER BY data ASC');
    
    if (result.rows) {
      // Return a dictionary of data -> testo
      const notes: Record<string, string> = {};
      result.rows.forEach((row) => {
        const dateStr = row.data instanceof Date ? format(row.data, 'yyyy-MM-dd') : row.data.split('T')[0];
        notes[dateStr] = row.testo;
      });
      return NextResponse.json(notes);
    }
    
    return NextResponse.json({});
  } catch (error) {
    console.error('Errore caricamento note pomeriggio:', error);
    return NextResponse.json({ error: 'Errore caricamento note' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { data, testo } = body;

    if (!data) {
      return NextResponse.json(
        { error: 'Campo data obbligatorio' },
        { status: 400 }
      );
    }

    if (!testo || testo.trim() === '') {
      // Delete if empty
      await query(`DELETE FROM epasa_note_pomeriggio WHERE data = $1`, [data]);
      return NextResponse.json({ success: true, deleted: true });
    }

    // Upsert
    const result = await query(
      `INSERT INTO epasa_note_pomeriggio (data, testo, created_at, updated_at) 
       VALUES ($1, $2, NOW(), NOW())
       ON CONFLICT (data) DO UPDATE 
       SET testo = EXCLUDED.testo, updated_at = NOW()
       RETURNING *`,
      [data, testo]
    );

    return NextResponse.json({ success: true, note: result.rows[0] });
  } catch (error) {
    console.error('Errore salvataggio nota pomeriggio:', error);
    return NextResponse.json({ error: 'Errore salvataggio nota' }, { status: 500 });
  }
}
