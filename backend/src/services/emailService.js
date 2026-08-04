import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

function emailConfig() {
  const port = Number.parseInt(process.env.EMAIL_PORT ?? '587', 10);
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) return null;
  return {
    host: process.env.EMAIL_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD }
  };
}

export async function sendPasswordRecoveryEmail({ email, token }) {
  const link = `${env.frontendUrl}/redefinir-senha?token=${encodeURIComponent(token)}`;
  const config = emailConfig();
  if (!config) {
    if (env.nodeEnv === 'development') console.log(`[email:development] Link de recuperação para ${email}: ${link}`);
    return;
  }
  const transporter = nodemailer.createTransport(config);
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Recuperação de senha',
    text: `Use este link em até 30 minutos para redefinir sua senha: ${link}`
  });
}

