import { addAudioMedicalClient, removeAudioMedicalClient } from '@/lib/sse';

export const dynamic = 'force-dynamic';

export async function GET() {
  let controller: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl;
      addAudioMedicalClient(controller);
      const hello = new TextEncoder().encode('event: connected\ndata: {}\n\n');
      controller.enqueue(hello);
    },
    cancel() {
      removeAudioMedicalClient(controller);
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
