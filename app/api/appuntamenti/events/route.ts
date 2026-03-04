import { add730Client, remove730Client } from '@/lib/sse';

export const dynamic = 'force-dynamic';

/**
 * GET /api/appuntamenti/events
 * Endpoint Server-Sent Events: mantiene aperta la connessione
 * e notifica i client ogni volta che avviene una modifica all'agenda 730.
 */
export async function GET() {
  let controller: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl;
      add730Client(controller);
      const hello = new TextEncoder().encode('event: connected\ndata: {}\n\n');
      controller.enqueue(hello);
    },
    cancel() {
      remove730Client(controller);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
