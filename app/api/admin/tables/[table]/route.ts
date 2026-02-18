import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ table: string }> }
) {
  try {
    
    const { table: tableName } = await context.params;

    console.log('Richiesta per tabella:', tableName);

    
    const validTables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    `, [tableName]);

    console.log('Tabelle trovate:', validTables.rows);

    if (validTables.rows.length === 0) {
      return NextResponse.json(
        { error: 'Tabella non trovata' },
        { status: 404 }
      );
    }

    
    const result = await query(`SELECT * FROM ${tableName} LIMIT 100`);

    return NextResponse.json({
      rows: result.rows || [],
      rowCount: result.rowCount || 0,
    });
  } catch (error: any) {
    console.error('Errore dettagliato:', error);
    return NextResponse.json(
      { error: error.message || 'Errore sconosciuto' },
      { status: 500 }
    );
  }
}
