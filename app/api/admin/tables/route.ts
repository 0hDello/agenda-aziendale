import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function GET() {
  try {
    
    const tablesResult = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const tables = await Promise.all(
      tablesResult.rows.map(async (table: any) => {
        
        const countResult = await query(`SELECT COUNT(*) as count FROM ${table.table_name}`);
        
        return {
          name: table.table_name,
          rowCount: parseInt(countResult.rows[0].count),
        };
      })
    );

    return NextResponse.json({ tables });
  } catch (error: any) {
    console.error('Errore:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
