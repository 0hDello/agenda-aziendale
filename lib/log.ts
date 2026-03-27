import { query } from '@/lib/postgres';

/**
 * Tipi di azione tracciabili
 */
export type LogAction = 'CREATE' | 'UPDATE' | 'DELETE';

/**
 * Sorgenti (agenda) tracciabili
 */
export type LogSource = 'EPASA' | 'SALA_RIUNIONI' | 'SCREENING';

/**
 * Scrive un record nella tabella activity_log.
 * La tabella viene creata automaticamente se non esiste.
 */
export async function logActivity(params: {
  source: LogSource;
  action: LogAction;
  descrizione: string;
  dettagli?: object;
}) {
  try {
    // Crea la tabella se non esiste (sicuro da chiamare ogni volta)
    await query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id SERIAL PRIMARY KEY,
        source VARCHAR(50) NOT NULL,
        action VARCHAR(20) NOT NULL,
        descrizione TEXT NOT NULL,
        dettagli JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await query(
      `INSERT INTO activity_log (source, action, descrizione, dettagli)
       VALUES ($1, $2, $3, $4)`,
      [
        params.source,
        params.action,
        params.descrizione,
        params.dettagli ? JSON.stringify(params.dettagli) : null,
      ]
    );
  } catch (err) {
    // Non bloccare mai l'operazione principale per un errore di log
    console.error('[logActivity] Errore scrittura log:', err);
  }
}
