import { NextResponse } from 'next/server';

// BUILD_ID viene impostato al momento del build/avvio del processo Node.
// Quando il server viene riavviato, il processo riparte e questo modulo
// viene re-importato: il timestamp cambia, segnalando la nuova versione.
const BUILD_ID = process.env.BUILD_ID ?? String(Date.now());

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { buildId: BUILD_ID },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
