import { formatDate, formatMoney } from './dateTime.js';
import { ADMIN_PHONE_INTERNATIONAL } from '../config/adminContact.js';

const names = (items) =>
  Array.isArray(items) && items.length > 0
    ? items.map((item) => `- ${item?.nome || 'Não informado'}`).join('\n')
    : '- Não informado';

const civilDate = (value) => {
  const normalized = String(value ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? formatDate(normalized) : 'Não informado';
};

export function buildPlanWhatsAppMessage(plan) {
  const weeklyLimit = plan?.possuiLimiteSemanal ? plan.limiteSemanal : 'Ilimitado';
  return [
    'Olá! Gostaria de finalizar a assinatura do plano:',
    '',
    `Plano: ${plan?.nome || 'Não informado'}`,
    `Valor: ${formatMoney(plan?.preco)}`,
    `Período: ${civilDate(plan?.utilizacaoInicio)} a ${civilDate(plan?.utilizacaoFim)}`,
    `Utilizações por semana: ${weeklyLimit ?? 'Ilimitado'}`,
    '',
    'Serviços incluídos:',
    names(plan?.servicos),
    '',
    'Profissionais:',
    names(plan?.barbeiros),
    '',
    'Gostaria de combinar o pagamento via Pix ou outra forma de pagamento.',
  ].join('\n');
}

export function buildPlanWhatsAppUrl(plan) {
  return `https://wa.me/${ADMIN_PHONE_INTERNATIONAL}?text=${encodeURIComponent(buildPlanWhatsAppMessage(plan))}`;
}
