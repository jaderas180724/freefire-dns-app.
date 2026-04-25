import { Pool } from 'pg';
import { logger } from './logger';

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://devflow:devflow_secret@localhost:5432/devflow_labs',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  logger.error('Unexpected database pool error', err);
});

export async function query(text: string, params?: unknown[]) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  logger.debug({ text, duration, rows: result.rowCount }, 'Executed query');
  return result;
}

export async function getClient() {
  return pool.connect();
}

export { pool };
