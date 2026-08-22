import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveApiBaseUrl } from '../src/api/client.js';

test('usa VITE_API_URL configurada sem alterar a URL de produção', () => {
  assert.equal(
    resolveApiBaseUrl('https://api.elite.example/api/', {
      protocol: 'http:',
      hostname: '192.168.1.23',
    }),
    'https://api.elite.example/api',
  );
});

test('sem VITE_API_URL usa o hostname de quem abriu o frontend', () => {
  assert.equal(
    resolveApiBaseUrl(undefined, { protocol: 'http:', hostname: '192.168.1.23' }),
    'http://192.168.1.23:3000/api',
  );
  assert.equal(
    resolveApiBaseUrl(undefined, { protocol: 'http:', hostname: 'localhost' }),
    'http://localhost:3000/api',
  );
});
