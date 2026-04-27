// pg connection pool. Server-only.
// Mirrors _legacy/api/src/config/db.js so query patterns transfer 1:1.

import 'server-only';
import { Pool, type QueryResult, type QueryResultRow } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

declare global {
  // eslint-disable-next-line no-var
  var __invPgPool: Pool | undefined;
}

const pool =
  global.__invPgPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 10,
  });

if (process.env.NODE_ENV !== 'production') global.__invPgPool = pool;

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function transaction<T>(fn: (q: typeof query) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const txQuery = ((text: string, params?: unknown[]) => client.query(text, params)) as typeof query;
    const result = await fn(txQuery);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export { pool };
