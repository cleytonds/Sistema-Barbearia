import assert from 'node:assert/strict';
import test from 'node:test';
import {
  requireAdmin,
  requireBarbeiro,
  requireCliente,
  requireRoles,
} from '../src/middlewares/authorize.js';

function execute(middleware, ...roles) {
  return new Promise((resolve) => {
    const req = roles.length ? { auth: { usuario: { papeis: roles } } } : {};
    middleware(req, {}, (error) => resolve(error ?? null));
  });
}

test('middlewares de perfil permitem apenas os papéis configurados', async () => {
  assert.equal(await execute(requireAdmin(), 'admin'), null);
  assert.equal((await execute(requireAdmin(), 'cliente')).statusCode, 403);
  assert.equal(await execute(requireBarbeiro(), 'barbeiro'), null);
  assert.equal(await execute(requireCliente(), 'cliente'), null);
  assert.equal(await execute(requireRoles('admin', 'barbeiro'), 'barbeiro'), null);
  assert.equal(await execute(requireAdmin(), 'barbeiro', 'admin'), null);
  assert.equal((await execute(requireCliente())).statusCode, 401);
});
