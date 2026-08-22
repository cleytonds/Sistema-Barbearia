import { isActiveTransactionContext } from '../database/transactionContext.js';
import { runTransactionWithRetry } from '../database/transactionRetry.js';
import { assertCommissionPercentage, calculateCommission } from '../domain/commissions/rules.js';
import * as comissaoRepository from '../repositories/comissaoRepository.js';
import { AppError } from '../utils/AppError.js';
import { paginationResult, parsePagination } from '../utils/pagination.js';

function assertContext(transactionContext, connection) {
  if (!connection || !isActiveTransactionContext(transactionContext))
    throw new AppError('Contexto transacional inválido.', 500, 'INVALID_TRANSACTION_CONTEXT');
}

function isValidPercentage(value) {
  try {
    assertCommissionPercentage(value);
    return true;
  } catch {
    return false;
  }
}

function isValidPlanBase(value) {
  try {
    return value != null && Number(value) > 0 && Boolean(calculateCommission(value, '0'));
  } catch {
    return false;
  }
}

export function avaliarConfiguracaoComissaoPreDeploy({ barbeiros, servicosPlanos }) {
  const barbeirosSemPercentualAvulso = [];
  const servicosPlanosSemValorBase = [];
  const configuracoesInvalidas = [];

  for (const barbeiro of barbeiros) {
    const item = { id: String(barbeiro.barbeiro_id), nome: barbeiro.barbeiro_nome };
    if (!barbeiro.configuracao_ativa || barbeiro.percentual_avulso == null)
      barbeirosSemPercentualAvulso.push(item);
    if (barbeiro.percentual_avulso != null && !isValidPercentage(barbeiro.percentual_avulso))
      configuracoesInvalidas.push({ ...item, campo: 'percentualAvulso' });
    if (barbeiro.percentual_plano != null && !isValidPercentage(barbeiro.percentual_plano))
      configuracoesInvalidas.push({ ...item, campo: 'percentualPlano' });
  }

  for (const servicoPlano of servicosPlanos) {
    const item = {
      plano: { id: String(servicoPlano.plano_id), nome: servicoPlano.plano_nome },
      servico: { id: String(servicoPlano.servico_id), nome: servicoPlano.servico_nome },
    };
    if (servicoPlano.valor_base_comissao == null) servicosPlanosSemValorBase.push(item);
    else if (!isValidPlanBase(servicoPlano.valor_base_comissao))
      configuracoesInvalidas.push({ ...item, campo: 'valorBaseComissao' });
  }

  return {
    ok:
      barbeirosSemPercentualAvulso.length === 0 &&
      servicosPlanosSemValorBase.length === 0 &&
      configuracoesInvalidas.length === 0,
    barbeirosSemPercentualAvulso,
    servicosPlanosSemValorBase,
    configuracoesInvalidas,
  };
}

export async function diagnosticarConfiguracaoComissaoPreDeploy({
  repository = comissaoRepository,
} = {}) {
  const [barbeiros, servicosPlanos] = await Promise.all([
    repository.listarBarbeirosAtivosParaDiagnostico(),
    repository.listarServicosDePlanosParaDiagnostico(),
  ]);
  return avaliarConfiguracaoComissaoPreDeploy({ barbeiros, servicosPlanos });
}

export async function configurarComissao({
  barbeiroId,
  percentualAvulso,
  percentualPlano,
  ativo = true,
}) {
  assertCommissionPercentage(percentualAvulso);
  assertCommissionPercentage(percentualPlano);
  await runTransactionWithRetry({
    operation: async ({ connection }) => {
      const barbeiro = await comissaoRepository.buscarBarbeiroAtivo(barbeiroId, connection);
      if (!barbeiro)
        throw new AppError('Profissional ativo não encontrado.', 404, 'BARBER_NOT_FOUND');
      await comissaoRepository.salvarConfiguracao(
        { barbeiroId, percentualAvulso, percentualPlano, ativo: Boolean(ativo) },
        connection,
      );
    },
  });
  return comissaoRepository.buscarConfiguracao(barbeiroId);
}

export async function configurarValorBasePlano({ planoId, servicoId, valorBase }) {
  calculateCommission(valorBase, '0.00');
  await runTransactionWithRetry({
    operation: async ({ connection }) => {
      const vinculo = await comissaoRepository.buscarServicoPlanoForUpdate(
        planoId,
        servicoId,
        connection,
      );
      if (!vinculo)
        throw new AppError('Serviço não pertence ao plano.', 404, 'PLAN_SERVICE_NOT_FOUND');
      await comissaoRepository.atualizarValorBasePlano(planoId, servicoId, valorBase, connection);
    },
  });
  return { planoId: String(planoId), servicoId: String(servicoId), valorBase: String(valorBase) };
}

function serializeCommission(row) {
  return {
    id: String(row.id),
    agendamentoId: String(row.agendamento_id),
    barbeiro: { id: String(row.barbeiro_id), nome: row.barbeiro_nome },
    servico: { id: String(row.servico_id), nome: row.servico_nome },
    tipoCobranca: row.tipo_cobranca,
    valorBaseSnapshot: row.valor_base_snapshot,
    percentualSnapshot: row.percentual_snapshot,
    valorComissao: row.valor_comissao,
    status: row.status,
    pagoPor: row.pago_por ? { id: String(row.pago_por), nome: row.pago_por_nome } : null,
    pagoEm: row.pago_em,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  };
}

export async function listarComissoes({ query }) {
  const pagination = parsePagination(
    query,
    { id: 'c.id', criadoEm: 'c.criado_em', valorComissao: 'c.valor_comissao' },
    'criadoEm',
  );
  const result = await comissaoRepository.listar(
    {
      barbeiroId: query.barbeiroId,
      inicio: query.inicio,
      fim: query.fim,
      tipo: query.tipo,
      status: query.status,
    },
    pagination,
  );
  return paginationResult(result.rows.map(serializeCommission), result.total, pagination);
}

export async function marcarComissaoComoPaga({ id, actorId, now = new Date() }) {
  const result = await runTransactionWithRetry({
    operation: async ({ connection }) => {
      const commission = await comissaoRepository.buscarPorIdForUpdate(id, connection);
      if (!commission) throw new AppError('Comissão não encontrada.', 404, 'COMMISSION_NOT_FOUND');
      if (commission.status === 'paga') return { replay: true };
      await comissaoRepository.marcarComoPaga(id, { actorId, now }, connection);
      return { replay: false };
    },
  });
  return {
    comissao: serializeCommission(await comissaoRepository.buscarPorId(id)),
    replay: result.replay,
  };
}

export async function gerarComissao({ agendamento, connection, transactionContext }) {
  assertContext(transactionContext, connection);
  const existente = await comissaoRepository.buscarPorAgendamentoForUpdate(
    agendamento.id,
    connection,
  );
  if (existente) return { comissaoId: existente.id, replay: true };

  const configuracao = await comissaoRepository.buscarConfiguracaoAtiva(
    agendamento.barbeiro_id,
    connection,
  );
  if (!configuracao)
    throw new AppError(
      'Comissão do profissional ainda não foi configurada.',
      409,
      'COMMISSION_CONFIGURATION_MISSING',
    );

  const tipoCobranca = agendamento.tipo_cobranca ?? 'avulso';
  let valorBase;
  let percentual;
  if (tipoCobranca === 'plano') {
    valorBase = await comissaoRepository.buscarValorBasePlano(
      agendamento.plano_id_snapshot,
      agendamento.servico_id,
      connection,
    );
    if (valorBase == null)
      throw new AppError(
        'Valor-base de comissão do plano não configurado para o serviço.',
        409,
        'PLAN_COMMISSION_BASE_MISSING',
      );
    percentual = configuracao.percentual_plano;
  } else {
    valorBase = String(agendamento.preco);
    percentual = configuracao.percentual_avulso;
  }

  const valorComissao = calculateCommission(valorBase, percentual);
  const id = await comissaoRepository.criar(
    {
      agendamentoId: agendamento.id,
      barbeiroId: agendamento.barbeiro_id,
      tipoCobranca,
      valorBase,
      percentual,
      valorComissao,
    },
    connection,
  );
  return { comissaoId: id, replay: false };
}
