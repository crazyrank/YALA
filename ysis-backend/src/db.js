const { Pool } = require('pg');
const config = require('./config');

// Neon requires SSL. rejectUnauthorized:false is standard for Neon's
// pooled connection string in most Node setups; the connection is still
// encrypted, this just skips strict CA chain validation.
const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  // Unexpected error on an idle client — log and let the process manager restart if needed.
  console.error('Unexpected PG pool error', err);
});

async function query(text, params) {
  return pool.query(text, params);
}

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
