'use strict';

const { Pool } = require('pg');
const env = require('./env');

const pool = new Pool({
  connectionString: env.db.connectionString,
  ssl: env.db.ssl,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle pg client:', err.message);
});

/** Simple parameterized query */
const query = (text, params) => pool.query(text, params);

/** Get a raw client (caller must release) */
const getClient = () => pool.connect();

/**
 * Run a set of operations in a single transaction.
 * Automatically commits or rolls back.
 *
 * @param {(client: import('pg').PoolClient) => Promise<any>} fn
 */
const transaction = async (fn) => {
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
};

module.exports = { query, getClient, transaction, pool };
