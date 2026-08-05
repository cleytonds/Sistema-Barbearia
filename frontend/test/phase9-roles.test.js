import assert from 'node:assert/strict';
import test from 'node:test';
const { normalizeRoles } = await import('../src/contexts/AuthContext.jsx');
const { destinationByRoles, safeInternalPath } = await import('../src/routes/routeSecurity.js');

test('normaliza papéis válidos, remove duplicações e mantém fallback legado', () => {
  assert.deepEqual(normalizeRoles({ perfil: 'barbeiro' }), ['barbeiro']);
  assert.deepEqual(
    normalizeRoles({ perfil: 'barbeiro', papeis: ['barbeiro', 'admin', 'admin', 'invalido'] }),
    ['barbeiro', 'admin'],
  );
});
test('destinos distinguem cliente, Cadu, admin único e Jonatas', () => {
  assert.equal(destinationByRoles({ papeis: ['cliente'] }), '/meus-agendamentos');
  assert.equal(destinationByRoles({ papeis: ['cliente'] }, '/agendar'), '/agendar');
  assert.equal(destinationByRoles({ papeis: ['barbeiro'] }), '/barbeiro');
  assert.equal(destinationByRoles({ papeis: ['admin'] }), '/admin');
  assert.equal(destinationByRoles({ papeis: ['barbeiro', 'admin'] }), '/selecionar-area');
  assert.equal(safeInternalPath('https://malicioso.test'), null);
});
