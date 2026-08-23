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

export async function diagnoseDatabaseSelection({
  databaseConfig = env.database,
  createConnection = mysql.createConnection,
} = {}) {
  const { database: databaseName, ...connectionConfig } = databaseConfig;
  const connection = await createConnection({ ...connectionConfig, connectTimeout: 5000 });
  try {
    await connection.query('SELECT DATABASE()');
    const [databases] = await connection.query('SHOW DATABASES');
    let useError = null;
    try {
      await connection.query('USE ??', [databaseName]);
    } catch (error) {
      useError = error;
    }
    return {
      databaseName,
      databaseListed: databases.some((row) => row.Database === databaseName),
      useError,
    };
  } finally {
    await connection.end();
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
