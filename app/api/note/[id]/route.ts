import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

type Params = { params: { id: string } };

// PUT — aggiorna nota (titolo, contenuto, colore, pinned)
export async function PUT(req: Request, { params }: Params) {
  try {
    const { titolo = '', contenuto, colore = 'amber', pinned = false } = await req.json();
    if (!contenuto?.trim()) {
      return NextResponse.json({ error: 'Il contenuto è obbligatorio' }, { status: 400 });
    }

    const result = await sql`
      UPDATE note
      SET
        titolo      = ${titolo.trim()},
        contenuto   = ${contenuto.trim()},
        colore      = ${colore},
        pinned      = ${pinned},
        updated_at  = NOW()
      WHERE id = ${params.id}::int
      RETURNING
        id::text,
        titolo,
        contenuto,
        pinned,
        colore,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `;
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Nota non trovata' }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('[PUT /api/note/[id]]', err);
    return NextResponse.json({ error: 'Errore nell\'aggiornamento della nota' }, { status: 500 });
  }
}

// DELETE — elimina nota
export async function DELETE(_req: Request, { params }: Params) {
  try {
    await sql`DELETE FROM note WHERE id = ${params.id}::int`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/note/[id]]', err);
    return NextResponse.json({ error: 'Errore nell\'eliminazione della nota' }, { status: 500 });
  }
}
