import assert from 'node:assert/strict';
import test from 'node:test';
import { sendPasswordRecoveryEmail } from '../src/services/emailService.js';

const environment = {
  BREVO_API_KEY: 'brevo_test_key_that_must_not_be_logged',
  EMAIL_FROM: 'contato@test.invalid',
  EMAIL_FROM_NAME: 'Elite Barbearia 081',
};
const frontendUrl = 'https://app.example.test';

test('recuperacao envia email por HTTPS a Brevo com remetente e destinatario corretos', async () => {
  let request;
  const response = { ok: true, status: 201 };
  const result = await sendPasswordRecoveryEmail(
    { email: 'cliente@test.invalid', token: 'token-de-teste' },
    {
      environment,
      frontendUrl,
      fetchImpl: async (url, options) => {
        request = { url, options };
        return response;
      },
    },
  );

  assert.equal(request.url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers['api-key'], environment.BREVO_API_KEY);
  assert.equal(request.options.headers.Accept, 'application/json');
  const body = JSON.parse(request.options.body);
  assert.deepEqual(body.sender, {
    name: environment.EMAIL_FROM_NAME,
    email: environment.EMAIL_FROM,
  });
  assert.deepEqual(body.to, [{ email: 'cliente@test.invalid' }]);
  assert.match(
    body.textContent,
    /https:\/\/app\.example\.test\/redefinir-senha\?token=token-de-teste/,
  );
  assert.equal(result, response);
});

test('recuperacao usa nome padrao seguro quando EMAIL_FROM_NAME esta ausente', async () => {
  let body;
  await sendPasswordRecoveryEmail(
    { email: 'cliente@test.invalid', token: 'token-de-teste' },
    {
      environment: { BREVO_API_KEY: environment.BREVO_API_KEY, EMAIL_FROM: environment.EMAIL_FROM },
      fetchImpl: async (_url, options) => {
        body = JSON.parse(options.body);
        return { ok: true, status: 200 };
      },
    },
  );
  assert.equal(body.sender.name, 'Elite Barbearia 081');
});

test('recuperacao sem Brevo nao chama HTTPS nem expoe token', async () => {
  let called = false;
  const token = 'segredo-que-nao-pode-aparecer';
  await assert.rejects(
    sendPasswordRecoveryEmail(
      { email: 'cliente@test.invalid', token },
      {
        environment: { EMAIL_FROM: environment.EMAIL_FROM },
        fetchImpl: async () => (called = true),
      },
    ),
    (error) =>
      error.code === 'EMAIL_NOT_CONFIGURED' &&
      error.statusCode === 503 &&
      !error.message.includes(token),
  );
  assert.equal(called, false);
});

test('falha HTTP da Brevo contem somente status seguro', async () => {
  const secret = environment.BREVO_API_KEY;
  await assert.rejects(
    sendPasswordRecoveryEmail(
      { email: 'cliente@test.invalid', token: 'token-de-teste' },
      { environment, fetchImpl: async () => ({ ok: false, status: 400 }) },
    ),
    (error) => error.code === 'BREVO_HTTP_400' && !error.message.includes(secret),
  );
});
