import assert from 'node:assert/strict';
import test from 'node:test';
import { sendPasswordRecoveryEmail } from '../src/services/emailService.js';

const environment = {
  EMAIL_HOST: 'smtp.test.invalid',
  EMAIL_PORT: '587',
  EMAIL_USER: 'mailer-user',
  EMAIL_PASSWORD: 'mailer-password',
  EMAIL_FROM: 'Elite 081 <contato@test.invalid>',
};

test('recuperação configurada chama sendMail com transporte SMTP seguro', async () => {
  let transportConfig;
  let message;
  const response = { accepted: ['cliente@test.invalid'], rejected: [], response: '250 queued' };

  const result = await sendPasswordRecoveryEmail(
    { email: 'cliente@test.invalid', token: 'token-de-teste' },
    {
      environment,
      createTransport(config) {
        transportConfig = config;
        return {
          async sendMail(value) {
            message = value;
            return response;
          },
        };
      },
    },
  );

  assert.deepEqual(transportConfig, {
    host: 'smtp.test.invalid',
    port: 587,
    secure: false,
    auth: { user: 'mailer-user', pass: 'mailer-password' },
  });
  assert.equal(message.from, environment.EMAIL_FROM);
  assert.equal(message.to, 'cliente@test.invalid');
  assert.match(message.text, /^Use este link em até 30 minutos/);
  assert.equal(result, response);
});

test('recuperação sem configuração não chama sendMail nem expõe token no erro', async () => {
  let transportCalled = false;
  const token = 'segredo-que-nao-pode-aparecer';

  await assert.rejects(
    sendPasswordRecoveryEmail(
      { email: 'cliente@test.invalid', token },
      {
        environment: { EMAIL_PORT: '587' },
        createTransport() {
          transportCalled = true;
        },
      },
    ),
    (error) =>
      error.code === 'EMAIL_NOT_CONFIGURED' &&
      error.statusCode === 503 &&
      !error.message.includes(token),
  );
  assert.equal(transportCalled, false);
});

test('rejeição SMTP é propagada para tratamento sanitizado pelo fluxo', async () => {
  const smtpError = Object.assign(new Error('Authentication failed'), { code: 'EAUTH' });

  await assert.rejects(
    sendPasswordRecoveryEmail(
      { email: 'cliente@test.invalid', token: 'token-de-teste' },
      {
        environment,
        createTransport: () => ({
          sendMail: async () => {
            throw smtpError;
          },
        }),
      },
    ),
    (error) => error === smtpError,
  );
});
