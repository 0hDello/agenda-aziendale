import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

const DEFAULT_AGENDE = [
  { id: '730', nome: 'Agenda 730', descrizione: 'Gestione appuntamenti per dichiarazioni 730', active: true },
  { id: 'epasa', nome: 'Agenda EPASA', descrizione: 'Gestione appuntamenti EPASA con operatori e sedi', active: true },
  { id: 'sale', nome: 'Sale Riunioni', descrizione: 'Prenotazione sale riunioni', active: true },
];

export async function GET() {
  try {
    
    const result = await query(
      'SELECT id, nome, descrizione, active, created_at, updated_at FROM agende ORDER BY nome'
    );
    return NextResponse.json(result.rows || []);
  } catch (error: any) {
    console.error('Errore caricamento agende:', error);
    
    if (error.code === '42P01' || error.code === '42703') {
      console.log('Tabella agende non trovata o schema non valido, uso agende statiche');
      return NextResponse.json(DEFAULT_AGENDE);
    }
    
    return NextResponse.json({ error: 'Errore caricamento agende' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, nome, descrizione, active = true } = body;

    if (!id || !nome) {
      return NextResponse.json(
        { error: 'ID e nome sono obbligatori' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO agende (id, nome, descrizione, active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING *`,
      [id, nome, descrizione || null, active]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error: any) {
    console.error('Errore creazione agenda:', error);
    
    if (error.code === '42P01') {
      return NextResponse.json(
        { error: 'Tabella agende non ancora creata nel database' },
        { status: 503 }
      );
    }
    
    return NextResponse.json({ error: 'Errore creazione agenda' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, active } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID obbligatorio' },
        { status: 400 }
      );
    }

    const result = await query(
      `UPDATE agende 
       SET active = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [active, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Agenda non trovata' },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    console.error('Errore aggiornamento agenda:', error);
    return NextResponse.json({ error: 'Errore aggiornamento agenda' }, { status: 500 });
  }
}
