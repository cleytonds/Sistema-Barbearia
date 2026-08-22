import { appointmentStatus } from './appointmentStatus.js';
import { formatDate } from './dateTime.js';

export const DEFAULT_BARBERSHOP_NAME = 'Elite Barbearia 081';
const SHAREABLE_STATUSES = new Set(['pendente', 'confirmado', 'em_atendimento']);

export function hasWhatsAppShareData(appointment) {
  return Boolean(
    appointment &&
    (typeof appointment.id === 'string' || typeof appointment.id === 'number') &&
    String(appointment.id).trim() &&
    appointment.servico?.nome &&
    appointment.barbeiro?.nome &&
    appointment.data &&
    appointment.horaInicio &&
    SHAREABLE_STATUSES.has(appointment.status) &&
    appointmentStatus[appointment.status],
  );
}

export function buildWhatsAppMessage(appointment, barbershopName = DEFAULT_BARBERSHOP_NAME) {
  if (!hasWhatsAppShareData(appointment)) return null;

  const safeName = String(barbershopName || DEFAULT_BARBERSHOP_NAME).trim();
  return [
    `Olá! Meu agendamento na ${safeName} foi realizado com sucesso.`,
    '',
    `Serviço: ${appointment.servico.nome}`,
    `Profissional: ${appointment.barbeiro.nome}`,
    `Data: ${formatDate(appointment.data)}`,
    `Horário: ${appointment.horaInicio}`,
    `Código do agendamento: ${String(appointment.id)}`,
    `Status: ${appointmentStatus[appointment.status].label}`,
  ].join('\n');
}

export function buildWhatsAppShareUrl(appointment, barbershopName) {
  const message = buildWhatsAppMessage(appointment, barbershopName);
  return message ? `https://wa.me/?text=${encodeURIComponent(message)}` : null;
}
