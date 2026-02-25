/**
 * Gestore globale dei client SSE per l'agenda EPASA e Sala Riunioni.
 * Mantiene un Set di controller attivi e permette di notificare
 * tutti i client connessi quando avviene una modifica.
 */

type SSEController = ReadableStreamDefaultController<Uint8Array>;

// ─── EPASA ────────────────────────────────────────────────────────────────────
declare global {
  // eslint-disable-next-line no-var
  var __epasaSSEClients: Set<SSEController> | undefined;
  // eslint-disable-next-line no-var
  var __roomSSEClients: Set<SSEController> | undefined;
}

if (!global.__epasaSSEClients) {
  global.__epasaSSEClients = new Set();
}

const epasaClients = global.__epasaSSEClients;

export function addEpasaClient(controller: SSEController) {
  epasaClients.add(controller);
}

export function removeEpasaClient(controller: SSEController) {
  epasaClients.delete(controller);
}

export function broadcastEpasaUpdate(eventType: string = 'update', data: object = {}) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  const encoded = new TextEncoder().encode(message);
  const toRemove: SSEController[] = [];

  epasaClients.forEach(controller => {
    try {
      controller.enqueue(encoded);
    } catch {
      toRemove.push(controller);
    }
  });

  toRemove.forEach(c => epasaClients.delete(c));
}

// ─── SALA RIUNIONI ────────────────────────────────────────────────────────────
if (!global.__roomSSEClients) {
  global.__roomSSEClients = new Set();
}

const roomClients = global.__roomSSEClients;

export function addRoomClient(controller: SSEController) {
  roomClients.add(controller);
}

export function removeRoomClient(controller: SSEController) {
  roomClients.delete(controller);
}

export function broadcastRoomUpdate(eventType: string = 'update', data: object = {}) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  const encoded = new TextEncoder().encode(message);
  const toRemove: SSEController[] = [];

  roomClients.forEach(controller => {
    try {
      controller.enqueue(encoded);
    } catch {
      toRemove.push(controller);
    }
  });

  toRemove.forEach(c => roomClients.delete(c));
}
