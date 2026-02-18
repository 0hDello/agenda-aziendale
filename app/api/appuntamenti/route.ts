import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { format } from 'date-fns';


export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mese = searchParams.get('mese');
    const anno = searchParams.get('anno');

    let sql = 'SELECT * FROM appuntamenti';
    const params: any[] = [];

    if (mese && anno) {
      sql += ` WHERE EXTRACT(MONTH FROM data::date) = $1 AND EXTRACT(YEAR FROM data::date) = $2`;
      params.push(parseInt(mese), parseInt(anno));
    }

    sql += ' ORDER BY data, ora_inizio';

    const result = await query(sql, params);
    
    
    if (result.rows) {
      const normalized = result.rows.map(apt => ({
        ...apt,
        
        data: apt.data instanceof Date 
          ? format(apt.data, 'yyyy-MM-dd') 
          : (typeof apt.data === 'string' ? apt.data.split('T')[0] : apt.data),
        
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
    console.error('Errore caricamento appuntamenti:', error);
    return NextResponse.json({ error: 'Errore caricamento appuntamenti' }, { status: 500 });
  }
}


export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { persona_id, sede_id, data, ora_inizio, ora_fine, cliente, note } = body;

    
    if (!persona_id || !sede_id || !data || !ora_inizio || !ora_fine) {
      return NextResponse.json(
        { error: 'Tutti i campi obbligatori devono essere compilati' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO appuntamenti (persona_id, sede_id, data, ora_inizio, ora_fine, cliente, note, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [persona_id, sede_id, data, ora_inizio, ora_fine, cliente || null, note || null]
    );

    
    if (result.rows && result.rows[0]) {
      const normalized = {
        ...result.rows[0],
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
    console.error('Errore creazione appuntamento:', error);
    return NextResponse.json({ error: 'Errore creazione appuntamento' }, { status: 500 });
  }
}
