import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function POST(request: NextRequest) {
  try {
    const { query: sqlQuery } = await request.json();

    if (!sqlQuery || typeof sqlQuery !== 'string') {
      return NextResponse.json(
        { error: 'Query non valida' },
        { status: 400 }
      );
    }

    
    const dangerousKeywords = ['DROP', 'TRUNCATE', 'DELETE', 'ALTER'];
    const queryUpper = sqlQuery.toUpperCase();
    
    

    const result = await query(sqlQuery);

    return NextResponse.json({
      rows: result.rows,
      rowCount: result.rowCount,
      fields: result.fields.map(f => ({ name: f.name, dataType: f.dataTypeID })),
    });
  } catch (error: any) {
    console.error('Errore query:', error);
    return NextResponse.json(
      { error: error.message || 'Errore durante l\'esecuzione della query' },
      { status: 500 }
    );
  }
}
