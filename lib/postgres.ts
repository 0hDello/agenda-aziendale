import { Pool } from 'pg';


const pool = new Pool({
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  max: 20, 
  min: 5, 
  idleTimeoutMillis: 30000, 
  connectionTimeoutMillis: 5000, 
});


pool.on('error', (err) => {
  console.error('Errore PostgreSQL pool:', err);
});


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


export const getClient = () => pool.connect();

export default pool;
