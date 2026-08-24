import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Vercel encaminha /api antes do fallback da SPA', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.deepEqual(config.rewrites[0], {
    source: '/api/(.*)',
    destination: 'https://sistema-barbearia-production-7801.up.railway.app/api/$1',
  });
  assert.deepEqual(config.rewrites[1], { source: '/(.*)', destination: '/index.html' });
});
