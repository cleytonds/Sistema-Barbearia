import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../config/database.js';

const directory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');
const lockName = 'barbearia_schema_migrations';

async function migrationFiles() {
  return (await readdir(directory))
    .filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/.test(name))
    .sort();
}

async function ensureControlTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      nome VARCHAR(255) NOT NULL,
      checksum CHAR(64) NOT NULL,
      executada_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (id),
      CONSTRAINT uq_schema_migrations_nome UNIQUE (nome)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function loadApplied(connection) {
  const [rows] = await connection.query('SELECT nome, checksum, executada_em FROM schema_migrations ORDER BY nome');
  return new Map(rows.map((row) => [row.nome, row]));
}

async function acquireLock(connection) {
  const [[row]] = await connection.execute('SELECT GET_LOCK(?, 10) AS acquired', [lockName]);
  if (row.acquired !== 1) throw new Error('Não foi possível obter o lock exclusivo das migrations.');
}

async function releaseLock(connection) {
  await connection.execute('SELECT RELEASE_LOCK(?)', [lockName]);
}

async function status(connection, files, applied) {
  for (const file of files) {
    console.log(`${applied.has(file) ? 'aplicada' : 'pendente'}  ${file}`);
  }
}

async function up(connection, files, applied) {
  for (const file of files) {
    const sql = (await readFile(path.join(directory, file), 'utf8')).trim().replace(/;\s*$/, '');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const previous = applied.get(file);

    if (previous) {
      if (previous.checksum !== checksum) throw new Error(`Migration já aplicada foi alterada: ${file}`);
      console.log(`ignorada  ${file}`);
      continue;
    }

    console.log(`aplicando ${file}`);
    try {
      // Cada arquivo contém um único DDL. No MySQL 8, esse DDL é atômico.
      await connection.query(sql);
      await connection.execute('INSERT INTO schema_migrations (nome, checksum) VALUES (?, ?)', [file, checksum]);
      console.log(`concluída ${file}`);
    } catch (error) {
      throw new Error(`Falha na migration ${file}: ${error.message}`, { cause: error });
    }
  }
}

async function main() {
  const command = process.argv[2] ?? 'up';
  if (!['up', 'status'].includes(command)) throw new Error(`Comando de migration inválido: ${command}`);

  const connection = await pool.getConnection();
  let locked = false;
  try {
    await acquireLock(connection);
    locked = true;
    await ensureControlTable(connection);
    const files = await migrationFiles();
    const applied = await loadApplied(connection);
    if (command === 'status') await status(connection, files, applied);
    else await up(connection, files, applied);
  } finally {
    if (locked) await releaseLock(connection);
    connection.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`[migrations] ${error.message}`);
  process.exitCode = 1;
});

