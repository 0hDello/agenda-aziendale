import { addRoomClient, removeRoomClient } from '@/lib/sse';

export const dynamic = 'force-dynamic';

/**
 * GET /api/room-appuntamenti/events
 * Endpoint Server-Sent Events: mantiene aperta la connessione
 * e notifica il client ogni volta che avviene una modifica alla sala riunioni.
 */
export async function GET() {
  let controller: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl;
      addRoomClient(controller);

      // Messaggio di connessione iniziale
      const hello = new TextEncoder().encode('event: connected\ndata: {}\n\n');
      controller.enqueue(hello);
    },
    cancel() {
      removeRoomClient(controller);
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
