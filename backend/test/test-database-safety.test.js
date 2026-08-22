import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { assertSafeTestDatabase } from '../src/config/testDatabaseSafety.js';

const envModule = new URL('../src/config/env.js', import.meta.url).href;

function loadEnv(databaseName) {
  return spawnSync(process.execPath, ['--input-type=module', '--eval', `import '${envModule}'`], {
    env: { ...process.env, NODE_ENV: 'test', DB_NAME: databaseName },
    encoding: 'utf8',
  });
}

test('recusa ambiente de teste apontando para banco sem sufixo seguro', () => {
  assert.throws(
    () => assertSafeTestDatabase('test', 'barbearia_agendamento'),
    /Refusing test execution against non-test database\./,
  );
});

test('aceita ambiente de teste apontando para banco isolado', () => {
  assert.doesNotThrow(() => assertSafeTestDatabase('test', 'barbearia_agendamento_test'));
});

test('carregamento da configuração recusa banco de desenvolvimento em ambiente de teste', () => {
  const result = loadEnv('barbearia_agendamento');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Refusing test execution against non-test database\./);
});

test('carregamento da configuração aceita banco isolado em ambiente de teste', () => {
  const result = loadEnv('barbearia_agendamento_test');
  assert.equal(result.status, 0, result.stderr);
});
