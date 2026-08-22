import mysql from 'mysql2/promise';
import { env } from './env.js';

export const pool = mysql.createPool({
  ...env.database,
  waitForConnections: true,
  connectTimeout: 5000,
  queueLimit: 0,
  enableKeepAlive: true,
  timezone: 'Z',
  decimalNumbers: true,
});

export async function checkDatabaseConnection() {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
  } finally {
    connection.release();
  }
}

export async function checkDatabaseReadiness(databasePool = pool) {
  const connection = await databasePool.getConnection();
  try {
    const [[configuration]] = await connection.execute(
      'SELECT 1 FROM configuracoes WHERE id = 1 LIMIT 1',
    );
    if (!configuration) throw new Error('Essential configuration is unavailable.');
  } finally {
    connection.release();
  }
}
