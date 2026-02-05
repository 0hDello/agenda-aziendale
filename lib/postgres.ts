import { Pool } from 'pg';

// Configurazione del connection pool
const pool = new Pool({
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  max: 20, // Massimo numero di connessioni nel pool
  min: 5, // Minimo numero di connessioni da mantenere
  idleTimeoutMillis: 30000, // Chiudi connessioni inattive dopo 30s
  connectionTimeoutMillis: 5000, // Timeout se non riesce a connettersi in 5s
});

// Gestione errori del pool
pool.on('error', (err) => {
  console.error('Errore PostgreSQL pool:', err);
});

// Funzione helper per le query
export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Query eseguita', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Errore query:', error);
    throw error;
  }
};

// Funzione per ottenere un client dal pool (per transazioni)
export const getClient = () => pool.connect();

export default pool;
