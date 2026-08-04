import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationDirectory = path.join(backendRoot, 'src', 'database', 'migrations');

test('migrations possuem ordem, nome único e um CREATE TABLE cada', async () => {
  const files = (await readdir(migrationDirectory)).filter((file) => file.endsWith('.sql')).sort();
  assert.equal(files.length, 11);
  assert.equal(new Set(files).size, files.length);
  assert.deepEqual(files.map((file) => file.slice(0, 3)), files.map((_, index) => String(index + 1).padStart(3, '0')));

  for (const file of files) {
    const sql = await readFile(path.join(migrationDirectory, file), 'utf8');
    assert.equal((sql.match(/CREATE TABLE/gi) ?? []).length, 1, file);
    assert.match(sql, /ENGINE=InnoDB/i, file);
  }
});

test('schema contém todas as tabelas de domínio aprovadas', async () => {
  const files = await readdir(migrationDirectory);
  const schema = (await Promise.all(files.map((file) => readFile(path.join(migrationDirectory, file), 'utf8')))).join('\n');
  const tables = ['usuarios', 'barbeiros', 'servicos', 'barbeiro_servicos', 'horarios_funcionamento', 'horarios_trabalho', 'bloqueios_agenda', 'agendamentos', 'historico_agendamentos', 'tokens_recuperacao_senha', 'configuracoes'];
  for (const table of tables) assert.match(schema, new RegExp(`CREATE TABLE ${table}\\b`, 'i'));
  assert.match(schema, /DECIMAL\(10,2\)/);
  assert.match(schema, /DATETIME\(6\)/);
  assert.match(schema, /FOREIGN KEY/);
  assert.match(schema, /CHECK \(/);
});

