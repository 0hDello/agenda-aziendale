/**
 * Gestore globale dei client SSE per l'agenda EPASA, Sala Riunioni e Agenda 730.
 */

type SSEController = ReadableStreamDefaultController<Uint8Array>;

declare global {
  // eslint-disable-next-line no-var
  var __epasaSSEClients: Set<SSEController> | undefined;
  // eslint-disable-next-line no-var
  var __roomSSEClients: Set<SSEController> | undefined;
  // eslint-disable-next-line no-var
  var __730SSEClients: Set<SSEController> | undefined;
}

// ─── EPASA ────────────────────────────────────────────────────────────────────
if (!global.__epasaSSEClients) global.__epasaSSEClients = new Set();
const epasaClients = global.__epasaSSEClients;

export function addEpasaClient(controller: SSEController) { epasaClients.add(controller); }
export function removeEpasaClient(controller: SSEController) { epasaClients.delete(controller); }
export function broadcastEpasaUpdate(eventType: string = 'update', data: object = {}) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  const encoded = new TextEncoder().encode(message);
  const toRemove: SSEController[] = [];
  epasaClients.forEach(c => { try { c.enqueue(encoded); } catch { toRemove.push(c); } });
  toRemove.forEach(c => epasaClients.delete(c));
}

// ─── SALA RIUNIONI ────────────────────────────────────────────────────────────
if (!global.__roomSSEClients) global.__roomSSEClients = new Set();
const roomClients = global.__roomSSEClients;

export function addRoomClient(controller: SSEController) { roomClients.add(controller); }
export function removeRoomClient(controller: SSEController) { roomClients.delete(controller); }
export function broadcastRoomUpdate(eventType: string = 'update', data: object = {}) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  const encoded = new TextEncoder().encode(message);
  const toRemove: SSEController[] = [];
  roomClients.forEach(c => { try { c.enqueue(encoded); } catch { toRemove.push(c); } });
  toRemove.forEach(c => roomClients.delete(c));
}

// ─── AGENDA 730 ──────────────────────────────────────────────────────────────
if (!global.__730SSEClients) global.__730SSEClients = new Set();
const agenda730Clients = global.__730SSEClients;

export function add730Client(controller: SSEController) { agenda730Clients.add(controller); }
export function remove730Client(controller: SSEController) { agenda730Clients.delete(controller); }
export function broadcast730Update(eventType: string = 'update', data: object = {}) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  const encoded = new TextEncoder().encode(message);
  const toRemove: SSEController[] = [];
  agenda730Clients.forEach(c => { try { c.enqueue(encoded); } catch { toRemove.push(c); } });
  toRemove.forEach(c => agenda730Clients.delete(c));
}
