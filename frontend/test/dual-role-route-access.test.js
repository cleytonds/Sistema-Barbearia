import assert from 'node:assert/strict';
import test from 'node:test';
import { isPathAuthorizedForUser, normalizeRoles } from '../src/routes/routeSecurity.js';

const jonatas = { perfil: 'barbeiro', papeis: ['barbeiro', 'admin'] };

test('Jonatas autenticado tem os dois papeis para acessar as areas protegidas', () => {
  assert.deepEqual(normalizeRoles(jonatas), ['barbeiro', 'admin']);
  assert.equal(isPathAuthorizedForUser({ perfil: 'barbeiro' }, '/barbeiro'), true);
  assert.equal(isPathAuthorizedForUser({ perfil: 'admin' }, '/admin'), true);
  assert.equal(normalizeRoles(jonatas).includes('barbeiro'), true);
  assert.equal(normalizeRoles(jonatas).includes('admin'), true);
});
