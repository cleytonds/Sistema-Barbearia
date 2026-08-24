import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const BREVO_EMAIL_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const DEFAULT_EMAIL_FROM_NAME = 'Elite Barbearia 081';

function emailConfig(environment) {
  if (!environment.BREVO_API_KEY || !environment.EMAIL_FROM)
    throw new AppError('Serviço de e-mail não configurado.', 503, 'EMAIL_NOT_CONFIGURED');
  return {
    apiKey: environment.BREVO_API_KEY,
    sender: {
      name: environment.EMAIL_FROM_NAME?.trim() || DEFAULT_EMAIL_FROM_NAME,
      email: environment.EMAIL_FROM,
    },
  };
}

export async function sendPasswordRecoveryEmail(
  { email, token },
  { environment = process.env, fetchImpl = fetch, frontendUrl = env.frontendUrl } = {},
) {
  const config = emailConfig(environment);
  const link = `${frontendUrl}/redefinir-senha?token=${encodeURIComponent(token)}`;
  const response = await fetchImpl(BREVO_EMAIL_ENDPOINT, {
    method: 'POST',
    headers: {
      'api-key': config.apiKey,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: config.sender,
      to: [{ email }],
      subject: 'Recuperação de senha',
      textContent: `Use este link em até 30 minutos para redefinir sua senha: ${link}`,
    }),
  });
  if (!response.ok) {
    const error = new Error('Password recovery email delivery failed.');
    error.code = `BREVO_HTTP_${response.status}`;
    throw error;
  }
  return response;
}
