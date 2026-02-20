/**
 * Gestore globale dei client SSE per l'agenda EPASA.
 * Mantiene un Set di controller attivi e permette di notificare
 * tutti i client connessi quando avviene una modifica.
 */

type SSEController = ReadableStreamDefaultController<Uint8Array>;

// Set globale dei client connessi (persiste tra le richieste grazie al singleton Next.js)
declare global {
  // eslint-disable-next-line no-var
  var __epasaSSEClients: Set<SSEController> | undefined;
}

if (!global.__epasaSSEClients) {
  global.__epasaSSEClients = new Set();
}

const clients = global.__epasaSSEClients;

export function addEpasaClient(controller: SSEController) {
  clients.add(controller);
}

export function removeEpasaClient(controller: SSEController) {
  clients.delete(controller);
}

/**
 * Invia un evento SSE a tutti i client connessi.
 * @param eventType - tipo di evento (es. 'update')
 * @param data - payload opzionale
 */
export function broadcastEpasaUpdate(eventType: string = 'update', data: object = {}) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  const encoded = new TextEncoder().encode(message);
  const toRemove: SSEController[] = [];

  clients.forEach(controller => {
    try {
      controller.enqueue(encoded);
    } catch {
      // Client disconnesso: lo rimuoviamo
      toRemove.push(controller);
    }
  });

  toRemove.forEach(c => clients.delete(c));
}
