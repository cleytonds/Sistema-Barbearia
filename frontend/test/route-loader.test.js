import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
for (const key of ['window', 'document', 'HTMLElement', 'Node']) globalThis[key] = dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = await import('react');
const { cleanup, render, screen } = await import('@testing-library/react');
const { RouteLoader } = await import('../src/components/ui/index.jsx');

test.afterEach(cleanup);

test('loader de rota e centralizado e nao mostra texto visivel', () => {
  render(React.createElement(RouteLoader, { label: 'Carregando página' }));
  const loader = screen.getByRole('status', { name: 'Carregando página' });
  assert.equal(loader.textContent, '');
  assert.ok(loader.querySelector('.route-loader__indicator'));
});
