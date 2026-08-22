import mysql from 'mysql2/promise';
import { env } from './env.js';

const LATEST_SCHEMA_MIGRATION = '018_create_barber_appointment_archives.sql';

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
    const [[readiness]] = await connection.execute(
      `SELECT
        EXISTS(SELECT 1 FROM configuracoes WHERE id = 1) AS configuration_ready,
        EXISTS(SELECT 1 FROM schema_migrations WHERE nome = ?) AS migration_ready`,
      [LATEST_SCHEMA_MIGRATION],
    );
    if (!readiness?.configuration_ready || !readiness.migration_ready)
      throw new Error('Database readiness requirements are unavailable.');
  } finally {
    connection.release();
  }
}
