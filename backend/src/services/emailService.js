import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

function emailConfig(environment) {
  const port = Number.parseInt(environment.EMAIL_PORT ?? '587', 10);
  if (
    !environment.EMAIL_HOST ||
    !environment.EMAIL_USER ||
    !environment.EMAIL_PASSWORD ||
    !environment.EMAIL_FROM
  ) {
    throw new AppError('Serviço de e-mail não configurado.', 503, 'EMAIL_NOT_CONFIGURED');
  }
  return {
    host: environment.EMAIL_HOST,
    port,
    secure: port === 465,
    auth: { user: environment.EMAIL_USER, pass: environment.EMAIL_PASSWORD },
  };
}

export async function sendPasswordRecoveryEmail(
  { email, token },
  { environment = process.env, createTransport = nodemailer.createTransport } = {},
) {
  const link = `${env.frontendUrl}/redefinir-senha?token=${encodeURIComponent(token)}`;
  const transporter = createTransport(emailConfig(environment));
  return transporter.sendMail({
    from: environment.EMAIL_FROM,
    to: email,
    subject: 'Recuperação de senha',
    text: `Use este link em até 30 minutos para redefinir sua senha: ${link}`,
  });
}
