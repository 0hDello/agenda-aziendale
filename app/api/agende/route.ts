import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function GET() {
  try {
    // Prova prima dal database
    try {
      const result = await query(
        `SELECT id, nome, descrizione, colore, icona, created_at, attiva 
         FROM agende 
         WHERE attiva = true 
         ORDER BY created_at ASC`
      );
      
      if (result.rows && result.rows.length > 0) {
        return NextResponse.json(result.rows);
      }
    } catch (dbError) {
      console.warn('Tabella agende non trovata, uso agende statiche');
    }

    // Fallback su agende statiche
    const staticAgende = [
      {
        id: '730',
        nome: 'Agenda 730',
        descrizione: 'Gestione appuntamenti',
        colore: '#005CA9',
        icona: 'calendar',
        created_at: new Date().toISOString(),
        attiva: true
      },
      {
        id: 'sala-riunioni-2026',
        nome: 'Sala Riunioni 2026',
        descrizione: 'Prenotazioni Imola, CSPT e Saletta Primo Piano',
        colore: '#16A34A',
        icona: 'calendar',
        created_at: new Date().toISOString(),
        attiva: true
      },
      {
        id: 'epasa',
        nome: 'EPASA',
        descrizione: 'Appuntamenti clienti - Imola, CSPT e Borgo',
        colore: '#9333EA',
        icona: 'calendar',
        created_at: new Date().toISOString(),
        attiva: true
      }
    ];

    return NextResponse.json(staticAgende);
  } catch (error) {
    console.error('Errore caricamento agende:', error);
    return NextResponse.json({ error: 'Errore caricamento agende' }, { status: 500 });
  }
}
