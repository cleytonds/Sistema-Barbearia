import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { resetPasswordErrorMessage, validateNewPassword } from '../src/pages/ResetPasswordPage.jsx';

test('validação da nova senha reflete o contrato do backend', () => {
  assert.equal(validateNewPassword('curta1'), 'A senha deve ter entre 8 e 72 caracteres.');
  assert.equal(validateNewPassword('semonumero'), 'A senha deve conter pelo menos um número.');
  assert.equal(validateNewPassword('12345678'), 'A senha deve conter pelo menos uma letra.');
  assert.equal(validateNewPassword('SenhaNova123'), null);
});

test('erro seguro do backend não é mascarado como token inválido', () => {
  assert.equal(
    resetPasswordErrorMessage({
      response: {
        status: 422,
        data: {
          error: {
            code: 'PASSWORD_UNCHANGED',
            message: 'A nova senha deve ser diferente da atual.',
          },
        },
      },
    }),
    'A nova senha deve ser diferente da senha atual.',
  );
});

test('página preserva o token da query e só o envia após submissão', async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost/redefinir-senha',
  });
  for (const key of ['window', 'document', 'HTMLElement', 'Node', 'CustomEvent']) {
    globalThis[key] = dom.window[key];
  }
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: dom.window.navigator,
  });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const React = await import('react');
  const { cleanup, render, screen } = await import('@testing-library/react');
  const userEvent = (await import('@testing-library/user-event')).default;
  const { MemoryRouter } = await import('react-router-dom');
  const { AuthContext } = await import('../src/contexts/AuthContext.jsx');
  const ResetPasswordPage = (await import('../src/pages/ResetPasswordPage.jsx')).default;
  const token = 'a'.repeat(64);
  const calls = [];

  render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [`/redefinir-senha?token=${token}`] },
      React.createElement(
        AuthContext.Provider,
        { value: { resetPassword: async (payload) => calls.push(payload) } },
        React.createElement(ResetPasswordPage),
      ),
    ),
  );
  assert.equal(calls.length, 0);
  const user = userEvent.setup({ document });
  await user.type(screen.getByLabelText('Nova senha'), 'SenhaNova123');
  await user.type(screen.getByLabelText('Confirmar nova senha'), 'SenhaNova123');
  await user.click(screen.getByRole('button', { name: 'Redefinir senha' }));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].token, token);
  cleanup();
});

test('confirmação diferente impede a requisição de redefinição', async () => {
  const React = await import('react');
  const { cleanup, render, screen } = await import('@testing-library/react');
  const userEvent = (await import('@testing-library/user-event')).default;
  const { MemoryRouter } = await import('react-router-dom');
  const { AuthContext } = await import('../src/contexts/AuthContext.jsx');
  const ResetPasswordPage = (await import('../src/pages/ResetPasswordPage.jsx')).default;
  let calls = 0;

  render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [`/redefinir-senha?token=${'b'.repeat(64)}`] },
      React.createElement(
        AuthContext.Provider,
        { value: { resetPassword: async () => calls++ } },
        React.createElement(ResetPasswordPage),
      ),
    ),
  );
  const user = userEvent.setup({ document });
  await user.type(screen.getByLabelText('Nova senha'), 'SenhaNova123');
  await user.type(screen.getByLabelText('Confirmar nova senha'), 'SenhaOutra456');
  await user.click(screen.getByRole('button', { name: 'Redefinir senha' }));
  assert.equal(calls, 0);
  assert.ok(screen.getByText('As senhas não conferem.'));
  cleanup();
});
