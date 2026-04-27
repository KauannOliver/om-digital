import mysql from 'mysql2/promise';
import { loadBackendEnv } from './env';

loadBackendEnv();

function requireEnv(name: string) {
  const val = process.env[name];
  if (!val) throw new Error(`Missing environment variable: ${name}`);
  return val;
}

const DB_HOST = requireEnv('DB_HOST');
const DB_NAME = requireEnv('DB_NAME');
const DB_USER = requireEnv('DB_USER');
const DB_PASSWORD = requireEnv('DB_PASSWORD');
const DB_PORT = Number(process.env.DB_PORT || '3306');
const DB_SSL = String(process.env.DB_SSL || 'false').toLowerCase() === 'true';

export const pool = mysql.createPool({
  host: DB_HOST,
  database: DB_NAME,
  user: DB_USER,
  password: DB_PASSWORD,
  port: DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: DB_SSL ? { rejectUnauthorized: false } : undefined
});

// Helper to track query count and log details
export async function trackedQuery(sql: string, params?: any[], context?: { queryCount: number }) {
  if (context) context.queryCount++;
  
  const start = Date.now();
  try {
    const result = await pool.query(sql, params);
    const duration = Date.now() - start;
    console.log(`[DB] Query executed in ${duration}ms: ${sql.substring(0, 100)}${sql.length > 100 ? '...' : ''}`);
    return result;
  } catch (err) {
    const duration = Date.now() - start;
    console.error(`[DB] Query FAILED in ${duration}ms: ${sql.substring(0, 100)}... Error:`, err);
    throw err;
  }
}