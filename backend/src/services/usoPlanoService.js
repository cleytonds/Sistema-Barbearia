import { isActiveTransactionContext } from '../database/transactionContext.js';
import { assertUsageTransition, weekStart } from '../domain/plans/rules.js';
import * as usoRepository from '../repositories/usoPlanoRepository.js';
import * as historicoRepository from '../repositories/historicoPlanoRepository.js';
import { AppError } from '../utils/AppError.js';

function assertContext(transactionContext, connection) {
  if (!connection || !isActiveTransactionContext(transactionContext))
    throw new AppError('Contexto transacional inválido.', 500, 'INVALID_TRANSACTION_CONTEXT');
}
const civilDate = (value) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
async function assertQuota(subscription, week, connection, excludingCurrent = false) {
  const [weekly, total] = await Promise.all([
    usoRepository.contarUsosSemana(subscription.id, week, connection),
    usoRepository.contarUsosTotal(subscription.id, connection),
  ]);
  const adjustment = excludingCurrent ? 1 : 0;
  if (
    subscription.possui_limite_semanal_snapshot &&
    weekly - adjustment >= subscription.limite_semanal_snapshot
  )
    throw new AppError('Limite semanal atingido.', 409, 'WEEKLY_PLAN_LIMIT_REACHED');
  if (
    subscription.possui_limite_total_snapshot &&
    total - adjustment >= subscription.limite_total_snapshot
  )
    throw new AppError('Limite total atingido.', 409, 'TOTAL_PLAN_LIMIT_REACHED');
}

export async function reservarUso({
  assinatura,
  agendamentoId,
  data,
  actorId,
  connection,
  transactionContext,
}) {
  assertContext(transactionContext, connection);
  const week = weekStart(data);
  const existing = await usoRepository.buscarUsoPorAgendamentoForUpdate(agendamentoId, connection);
  if (existing) {
    if (String(existing.assinatura_id) === String(assinatura.id))
      return { usoId: existing.id, replay: true };
    throw new AppError('Agendamento já possui utilização.', 409, 'DUPLICATE_PLAN_USAGE');
  }
  await assertQuota(assinatura, week, connection);
  const id = await usoRepository.criarUsoReservado(
    { subscriptionId: assinatura.id, appointmentId: agendamentoId, date: data, week },
    connection,
  );
  await historicoRepository.registrarEvento(
    {
      subscriptionId: assinatura.id,
      usageId: id,
      type: 'utilizacao_reservada',
      actorId,
      after: { agendamentoId: String(agendamentoId), data, semanaInicio: week },
    },
    connection,
  );
  return { usoId: id, replay: false };
}

export async function consumirUso({
  agendamentoId,
  actorId,
  connection,
  transactionContext,
  now = new Date(),
  motivo,
  responsabilidade,
}) {
  assertContext(transactionContext, connection);
  const usage = await usoRepository.buscarUsoPorAgendamentoForUpdate(agendamentoId, connection);
  if (!usage) return null;
  if (usage.status === 'consumido') return { usoId: usage.id, replay: true };
  assertUsageTransition(usage.status, 'consumido');
  await usoRepository.consumirUso(usage.id, now, connection);
  await historicoRepository.registrarEvento(
    {
      subscriptionId: usage.assinatura_id,
      usageId: usage.id,
      type: 'utilizacao_consumida',
      actorId,
      note: motivo?.trim() || null,
      after: { status: 'consumido', ...(responsabilidade && { responsabilidade }) },
    },
    connection,
  );
  return { usoId: usage.id, replay: false };
}

export async function liberarUso({
  agendamentoId,
  actorId,
  motivo,
  administrativo = false,
  connection,
  transactionContext,
  now = new Date(),
  responsabilidade,
}) {
  assertContext(transactionContext, connection);
  if (administrativo && !motivo?.trim())
    throw new AppError('Motivo administrativo obrigatório.', 422, 'VALIDATION_ERROR');
  const usage = await usoRepository.buscarUsoPorAgendamentoForUpdate(agendamentoId, connection);
  if (!usage) return null;
  if (usage.status === 'liberado') return { usoId: usage.id, replay: true };
  assertUsageTransition(usage.status, 'liberado');
  const note = motivo?.trim() || 'Cancelamento regular';
  await usoRepository.liberarUso(usage.id, { now, motivo: note }, connection);
  await historicoRepository.registrarEvento(
    {
      subscriptionId: usage.assinatura_id,
      usageId: usage.id,
      type: 'utilizacao_liberada',
      actorId,
      note,
      after: { status: 'liberado', ...(responsabilidade && { responsabilidade }) },
    },
    connection,
  );
  return { usoId: usage.id, replay: false };
}

export async function atualizarUsoNoReagendamento({
  agendamentoId,
  assinatura,
  data,
  continuaCoberto,
  actorId,
  motivo = 'Cobertura perdida no reagendamento',
  connection,
  transactionContext,
  now = new Date(),
}) {
  assertContext(transactionContext, connection);
  const usage = await usoRepository.buscarUsoPorAgendamentoForUpdate(agendamentoId, connection);
  if (!usage) return null;
  if (!continuaCoberto)
    return liberarUso({ agendamentoId, actorId, motivo, connection, transactionContext, now });
  if (usage.status !== 'reservado')
    throw new AppError('Utilização não pode ser reagendada.', 409, 'INVALID_USAGE_TRANSITION');
  const week = weekStart(data);
  await assertQuota(
    assinatura,
    week,
    connection,
    civilDate(usage.semana_inicio) === civilDate(week),
  );
  await usoRepository.atualizarPeriodoDoUso(usage.id, { date: data, week }, connection);
  return { usoId: usage.id, semanaInicio: week };
}
