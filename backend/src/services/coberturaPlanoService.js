import { BILLING_TYPE, NO_COVERAGE_REASON } from '../domain/plans/constants.js';
import { weekStart } from '../domain/plans/rules.js';
import * as assinaturaRepository from '../repositories/assinaturaPlanoRepository.js';
import * as pagamentoRepository from '../repositories/pagamentoPlanoRepository.js';
import * as usoRepository from '../repositories/usoPlanoRepository.js';

const single = (motivo) => ({ tipoCobranca: BILLING_TYPE.SINGLE, motivo });
const dateValue = (value) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);

export async function decidirCobertura({
  clienteId,
  servicoId,
  barbeiroId,
  data,
  connection,
  agendamentoIdIgnorado,
}) {
  const civil = dateValue(data);
  const candidates = await assinaturaRepository.buscarAssinaturasAtivasDoCliente(
    clienteId,
    connection,
  );
  if (!candidates.length) return single(NO_COVERAGE_REASON.NO_ACTIVE_SUBSCRIPTION);
  let subscription;
  for (const candidate of candidates) {
    const full = connection
      ? await assinaturaRepository.buscarAssinaturaPorIdForUpdate(candidate.id, connection)
      : await assinaturaRepository.buscarAssinaturaPorId(candidate.id);
    if (full.status === 'ativa') {
      subscription = full;
      if (civil >= dateValue(full.inicio_em) && civil <= dateValue(full.fim_em)) break;
    }
  }
  if (!subscription) return single(NO_COVERAGE_REASON.NO_ACTIVE_SUBSCRIPTION);
  if (civil < dateValue(subscription.inicio_em) || civil > dateValue(subscription.fim_em))
    return single(NO_COVERAGE_REASON.OUTSIDE_PERIOD);
  if (subscription.uso_status !== 'permitido') return single(NO_COVERAGE_REASON.PLAN_SUSPENDED);
  if (
    !(await pagamentoRepository.verificarPagamentoConfirmadoParaData(
      subscription.id,
      civil,
      connection,
    ))
  )
    return single(NO_COVERAGE_REASON.PAYMENT_PENDING);
  if (!(await assinaturaRepository.hasService(subscription.id, servicoId, connection)))
    return single(NO_COVERAGE_REASON.SERVICE_NOT_INCLUDED);
  if (!(await assinaturaRepository.hasBarber(subscription.id, barbeiroId, connection)))
    return single(NO_COVERAGE_REASON.BARBER_NOT_INCLUDED);
  const semanaInicio = weekStart(civil);
  let usoSemanal = await usoRepository.contarUsosSemana(subscription.id, semanaInicio, connection);
  let usoTotal = await usoRepository.contarUsosTotal(subscription.id, connection);
  if (agendamentoIdIgnorado) {
    const currentUsage = await usoRepository.buscarUsoPorAgendamento(
      agendamentoIdIgnorado,
      connection,
    );
    if (
      currentUsage &&
      String(currentUsage.assinatura_id) === String(subscription.id) &&
      ['reservado', 'consumido'].includes(currentUsage.status)
    ) {
      usoTotal = Math.max(0, usoTotal - 1);
      if (dateValue(currentUsage.semana_inicio) === semanaInicio)
        usoSemanal = Math.max(0, usoSemanal - 1);
    }
  }
  if (
    subscription.possui_limite_semanal_snapshot &&
    usoSemanal >= subscription.limite_semanal_snapshot
  )
    return single(NO_COVERAGE_REASON.WEEKLY_LIMIT_REACHED);
  if (subscription.possui_limite_total_snapshot && usoTotal >= subscription.limite_total_snapshot)
    return single(NO_COVERAGE_REASON.TOTAL_LIMIT_REACHED);
  return {
    tipoCobranca: BILLING_TYPE.PLAN,
    assinaturaId: String(subscription.id),
    planoId: String(subscription.plano_id),
    planoNome: subscription.plano_nome_snapshot,
    possuiLimiteSemanal: Boolean(subscription.possui_limite_semanal_snapshot),
    limiteSemanal: subscription.limite_semanal_snapshot,
    usoSemanal,
    possuiLimiteTotal: Boolean(subscription.possui_limite_total_snapshot),
    limiteTotal: subscription.limite_total_snapshot,
    usoTotal,
    semanaInicio,
    assinatura: subscription,
  };
}
