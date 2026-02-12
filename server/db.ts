import mysql from 'mysql2/promise';
import { loadBackendEnv } from './env';

loadBackendEnv();

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing environment variable: ${name}`);
  return val;
}

const DB_HOST = requireEnv('DB_HOST');
const DB_NAME = requireEnv('DB_NAME');
const DB_USER = requireEnv('DB_USER');
const DB_PASSWORD = requireEnv('DB_PASSWORD');
const DB_PORT = Number(process.env.DB_PORT || '3306');
const DB_SSL = (process.env.DB_SSL || 'true').toLowerCase() === 'true';

const ssl = DB_SSL
  ? {
      rejectUnauthorized: true,
      ca: process.env.DB_SSL_CA
    }
  : undefined;

export const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  port: DB_PORT,
  ssl,
  dateStrings: true,
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000
});
