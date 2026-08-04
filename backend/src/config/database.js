import mysql from 'mysql2/promise';
import { env } from './env.js';

export const pool = mysql.createPool({
  ...env.database,
  waitForConnections: true,
  connectTimeout: 5000,
  queueLimit: 0,
  enableKeepAlive: true,
  timezone: 'Z',
  decimalNumbers: true
});

export async function checkDatabaseConnection() {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
  } finally {
    connection.release();
  }
}
