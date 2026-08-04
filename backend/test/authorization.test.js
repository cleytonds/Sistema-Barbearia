import assert from 'node:assert/strict';
import test from 'node:test';
import { requireAdmin, requireBarbeiro, requireCliente, requireRoles } from '../src/middlewares/authorize.js';

function execute(middleware, profile) {
  return new Promise((resolve) => {
    const req = profile ? { auth: { usuario: { perfil: profile } } } : {};
    middleware(req, {}, (error) => resolve(error ?? null));
  });
}

test('middlewares de perfil permitem apenas os papéis configurados', async () => {
  assert.equal(await execute(requireAdmin(), 'admin'), null);
  assert.equal((await execute(requireAdmin(), 'cliente')).statusCode, 403);
  assert.equal(await execute(requireBarbeiro(), 'barbeiro'), null);
  assert.equal(await execute(requireCliente(), 'cliente'), null);
  assert.equal(await execute(requireRoles('admin', 'barbeiro'), 'barbeiro'), null);
  assert.equal((await execute(requireCliente(), null)).statusCode, 401);
});

