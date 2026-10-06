const fs = require('fs');
const { Pool } = require('pg');

const env = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
for (const line of env.split('\n')) {
  const idx = line.indexOf('=');
  if (idx !== -1) {
    envVars[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
  }
}

const pool = new Pool({
  host: envVars.DATABASE_HOST || 'localhost',
  port: parseInt(envVars.DATABASE_PORT || '5432'),
  database: envVars.DATABASE_NAME,
  user: envVars.DATABASE_USER,
  password: envVars.DATABASE_PASSWORD,
});

async function run() {
  const r1 = await pool.query(`
    SELECT d::date as data, '12:00'::time as ora
    FROM generate_series('2027-04-01'::date, '2027-12-31'::date, '1 day'::interval) d
    WHERE EXTRACT(ISODOW FROM d) BETWEEN 1 AND 5
    LIMIT 5
  `);
  console.log('GENERATE SERIES SAMPLE:', r1.rows);

  const r2 = await pool.query(`
    SELECT * FROM epasa_appuntamenti
    WHERE sede_id = 'imola' AND operatore_id = 'MILECE' AND data >= '2027-04-01' AND data <= '2027-04-05'
  `);
  console.log('SAMPLE 2027-04-01 to 05:', r2.rows);

  await pool.end();
}

run().catch(console.error);
