import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// GET — lista tutte le note
export async function GET() {
  try {
    const result = await sql`
      SELECT
        id::text,
        titolo,
        contenuto,
        pinned,
        colore,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM note
      ORDER BY pinned DESC, updated_at DESC
    `;
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('[GET /api/note]', err);
    return NextResponse.json({ error: 'Errore nel recupero delle note' }, { status: 500 });
  }
}

// POST — crea nuova nota
export async function POST(req: Request) {
  try {
    const { titolo = '', contenuto, colore = 'amber' } = await req.json();
    if (!contenuto?.trim()) {
      return NextResponse.json({ error: 'Il contenuto è obbligatorio' }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO note (titolo, contenuto, colore, pinned)
      VALUES (${titolo.trim()}, ${contenuto.trim()}, ${colore}, false)
      RETURNING
        id::text,
        titolo,
        contenuto,
        pinned,
        colore,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `;
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('[POST /api/note]', err);
    return NextResponse.json({ error: 'Errore nella creazione della nota' }, { status: 500 });
  }
}
