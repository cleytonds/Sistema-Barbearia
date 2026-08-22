import { runTransactionWithRetry } from '../database/transactionRetry.js';
import { assertLimits, assertPeriod } from '../domain/plans/rules.js';
import * as planoRepository from '../repositories/planoRepository.js';
import * as servicoRepository from '../repositories/servicoRepository.js';
import * as barbeiroRepository from '../repositories/barbeiroRepository.js';
import * as historicoPlanoRepository from '../repositories/historicoPlanoRepository.js';
import { AppError } from '../utils/AppError.js';
import { isMoney } from '../utils/decimal.js';
import { normalizeName } from '../utils/normalize.js';
import { paginationResult, parsePagination } from '../utils/pagination.js';

const DESC_MAX_LENGTH = 500;

const allowedSorts = {
  id: 'id',
  nome: 'nome',
  preco: 'preco',
  criado_em: 'criado_em',
};

function normalizeDescricao(descricao) {
  if (descricao == null || descricao.trim() === '') return null;
  const trimmed = descricao.trim();
  if (trimmed.length > DESC_MAX_LENGTH)
    throw new AppError('Descrição muito longa.', 422, 'VALIDATION_ERROR');
  return trimmed;
}

function assertUniqueIds(ids, label) {
  if (!Array.isArray(ids) || ids.length === 0)
    throw new AppError(`Informe ao menos um ${label}.`, 422, 'VALIDATION_ERROR');
  if (new Set(ids.map((id) => Number(id))).size !== ids.length)
    throw new AppError(`${label} repetidos não são aceitos.`, 422, 'VALIDATION_ERROR');
}

function normalizePlan(data) {
  return {
    nome: normalizeName(data.nome),
    descricao: normalizeDescricao(data.descricao),
    preco: data.preco,
    adesaoInicio: data.adesaoInicio,
    adesaoFim: data.adesaoFim,
    utilizacaoInicio: data.utilizacaoInicio,
    utilizacaoFim: data.utilizacaoFim,
    possuiLimiteSemanal: Boolean(data.possuiLimiteSemanal),
    limiteSemanal: data.limiteSemanal ?? null,
    possuiLimiteTotal: Boolean(data.possuiLimiteTotal),
    limiteTotal: data.limiteTotal ?? null,
    ativo: data.ativo ?? true,
    adesoesAbertas: data.adesoesAbertas ?? true,
    actorId: data.actorId,
  };
}

function assertPlanPayload(data, planoNomesValidos = null) {
  if (!planoNomesValidos) planoNomesValidos = [];
  if (!data?.nome?.trim())
    throw new AppError('Nome do plano é obrigatório.', 422, 'VALIDATION_ERROR');
  if (!isMoney(data.preco)) throw new AppError('Preço inválido.', 422, 'INVALID_PLAN_PRICE');
  if (!Number.isInteger(Number(data.actorId)) || Number(data.actorId) <= 0)
    throw new AppError('Autor inválido.', 422, 'VALIDATION_ERROR');
  // Períodos de adesão e de utilização são validados pelo domínio puro.
  assertPeriod({ inicio: data.adesaoInicio, fim: data.adesaoFim });
  assertPeriod({ inicio: data.utilizacaoInicio, fim: data.utilizacaoFim });
  assertLimits({
    possuiLimiteSemanal: Boolean(data.possuiLimiteSemanal),
    limiteSemanal: data.limiteSemanal ?? null,
    possuiLimiteTotal: Boolean(data.possuiLimiteTotal),
    limiteTotal: data.limiteTotal ?? null,
  });
  assertUniqueIds(data.servicos, 'serviço');
  assertUniqueIds(data.barbeiros, 'barbeiro');
  return normalizePlan(data);
}

async function validateLinkedRecords(serviceIds, barberIds, connection) {
  const services = [];
  const seenServices = new Set();
  for (const id of serviceIds) {
    const numericId = Number(id);
    if (seenServices.has(numericId)) continue;
    seenServices.add(numericId);
    const service = await servicoRepository.findService(numericId, connection);
    if (!service) throw new AppError('Serviço não encontrado.', 404, 'SERVICE_NOT_FOUND');
    if (!service.ativo)
      throw new AppError('Serviço inativo não pode ser vinculado.', 422, 'INVALID_PLAN_LINK');
    services.push(service);
  }

  const barbers = [];
  const seenBarbers = new Set();
  for (const id of barberIds) {
    const numericId = Number(id);
    if (seenBarbers.has(numericId)) continue;
    seenBarbers.add(numericId);
    const barber = await barbeiroRepository.findBarber(numericId, connection);
    if (!barber) throw new AppError('Barbeiro não encontrado.', 404, 'BARBER_NOT_FOUND');
    if (!barber.ativo || !barber.usuario_ativo)
      throw new AppError('Barbeiro inativo não pode ser vinculado.', 422, 'INVALID_PLAN_LINK');
    barbers.push(barber);
  }
  return { services, barbers };
}

async function assertNomeDuplicado(nome, { excludeId, connection }) {
  const id = await planoRepository.verificarNomeDuplicado(nome, { excludeId, connection });
  if (id) throw new AppError('Já existe um plano com esse nome.', 409, 'DUPLICATE_PLAN_NAME');
}

function buildLogContext(id, actorId) {
  return { planoId: id, usuarioId: actorId, operation: 'plano' };
}

export async function criarPlano({ data, actorId, requestId }) {
  const payload = assertPlanPayload({ ...data, actorId });
  const logContext = buildLogContext(null, actorId);
  return runTransactionWithRetry({
    logContext: { ...logContext, requestId, operation: 'plano_criar' },
    operation: async ({ connection }) => {
      await assertNomeDuplicado(payload.nome, { connection });
      const { services, barbers } = await validateLinkedRecords(
        data.servicos,
        data.barbeiros,
        connection,
      );
      const planId = await planoRepository.criarPlano(payload, connection);
      await planoRepository.substituirServicos(
        planId,
        services.map((s) => s.id),
        connection,
      );
      await planoRepository.substituirBarbeiros(
        planId,
        barbers.map((b) => b.id),
        connection,
      );
      await historicoPlanoRepository.registrarEvento(
        {
          planId,
          type: 'plano_criado',
          actorId,
          note: 'Plano criado',
          after: { nome: payload.nome, preco: payload.preco },
        },
        connection,
      );
      return planId;
    },
  });
}

export async function editarPlano({ id, data, actorId, requestId }) {
  const payload = assertPlanPayload({ ...data, actorId });
  const logContext = buildLogContext(id, actorId);
  return runTransactionWithRetry({
    logContext: { ...logContext, requestId, operation: 'plano_editar' },
    operation: async ({ connection }) => {
      const plano = await planoRepository.buscarPlanoPorIdForUpdate(id, connection);
      if (!plano) throw new AppError('Plano não encontrado.', 404, 'PLAN_NOT_FOUND');
      await assertNomeDuplicado(payload.nome, { excludeId: id, connection });
      const { services, barbers } = await validateLinkedRecords(
        data.servicos,
        data.barbeiros,
        connection,
      );
      await planoRepository.atualizarPlano(id, payload, connection);
      await planoRepository.substituirServicos(
        id,
        services.map((s) => s.id),
        connection,
      );
      await planoRepository.substituirBarbeiros(
        id,
        barbers.map((b) => b.id),
        connection,
      );
      await historicoPlanoRepository.registrarEvento(
        {
          planId: id,
          type: 'plano_editado',
          actorId,
          note: 'Plano editado',
          before: { nome: plano.nome, preco: plano.preco },
          after: { nome: payload.nome, preco: payload.preco },
        },
        connection,
      );
      return id;
    },
  });
}

async function mutarCampo({ id, actorId, campo, valor, evento, nota, requestId }) {
  const logContext = buildLogContext(id, actorId);
  return runTransactionWithRetry({
    logContext: { ...logContext, requestId, operation: 'plano_mutar' },
    operation: async ({ connection }) => {
      const plano = await planoRepository.buscarPlanoPorIdForUpdate(id, connection);
      if (!plano) throw new AppError('Plano não encontrado.', 404, 'PLAN_NOT_FOUND');
      if (campo === 'ativo')
        await planoRepository.atualizarStatus(id, 'ativo', valor, actorId, connection);
      else if (campo === 'adesoes')
        await planoRepository.atualizarAdesoes(id, valor, actorId, connection);
      await historicoPlanoRepository.registrarEvento(
        {
          planId: id,
          type: evento,
          actorId,
          note: nota,
          before: { [campo]: !valor },
          after: { [campo]: valor },
        },
        connection,
      );
      return id;
    },
  });
}

export async function ativarPlano({ id, actorId, requestId }) {
  return mutarCampo({
    id,
    actorId,
    campo: 'ativo',
    valor: true,
    evento: 'plano_ativado',
    nota: 'Plano ativado',
    requestId,
  });
}

export async function desativarPlano({ id, actorId, requestId }) {
  return mutarCampo({
    id,
    actorId,
    campo: 'ativo',
    valor: false,
    evento: 'plano_desativado',
    nota: 'Plano desativado',
    requestId,
  });
}

export async function abrirAdesoes({ id, actorId, requestId }) {
  return mutarCampo({
    id,
    actorId,
    campo: 'adesoes',
    valor: true,
    evento: 'adesoes_abertas',
    nota: 'Adesões abertas',
    requestId,
  });
}

export async function fecharAdesoes({ id, actorId, requestId }) {
  return mutarCampo({
    id,
    actorId,
    campo: 'adesoes',
    valor: false,
    evento: 'adesoes_fechadas',
    nota: 'Adesões fechadas',
    requestId,
  });
}

export async function suspenderUso({ id, actorId, motivo, requestId }) {
  if (!motivo?.trim())
    throw new AppError('Motivo obrigatório para suspensão.', 422, 'VALIDATION_ERROR');
  const logContext = buildLogContext(id, actorId);
  return runTransactionWithRetry({
    logContext: { ...logContext, requestId, operation: 'plano_suspender_uso' },
    operation: async ({ connection }) => {
      const plano = await planoRepository.buscarPlanoPorIdForUpdate(id, connection);
      if (!plano) throw new AppError('Plano não encontrado.', 404, 'PLAN_NOT_FOUND');
      await planoRepository.atualizarUso(
        id,
        { status: 'suspenso', motivo: motivo.trim(), actorId, now: new Date() },
        connection,
      );
      await historicoPlanoRepository.registrarEvento(
        { planId: id, type: 'uso_suspenso', actorId, note: motivo.trim() },
        connection,
      );
      return id;
    },
  });
}

export async function permitirUso({ id, actorId, requestId }) {
  const logContext = buildLogContext(id, actorId);
  return runTransactionWithRetry({
    logContext: { ...logContext, requestId, operation: 'plano_permitir_uso' },
    operation: async ({ connection }) => {
      const plano = await planoRepository.buscarPlanoPorIdForUpdate(id, connection);
      if (!plano) throw new AppError('Plano não encontrado.', 404, 'PLAN_NOT_FOUND');
      await planoRepository.atualizarUso(
        id,
        { status: 'permitido', motivo: null, actorId, now: null },
        connection,
      );
      await historicoPlanoRepository.registrarEvento(
        { planId: id, type: 'uso_permitido', actorId, note: 'Uso permitido novamente' },
        connection,
      );
      return id;
    },
  });
}

export async function obterPlanoAdmin({ id }) {
  const plano = await planoRepository.buscarPlanoPorId(id);
  if (!plano) throw new AppError('Plano não encontrado.', 404, 'PLAN_NOT_FOUND');
  const [servicos, barbeiros] = await Promise.all([
    planoRepository.listarServicosDoPlano(id, { includeCommissionBase: true }),
    planoRepository.listarBarbeirosDoPlano(id),
  ]);
  return { ...plano, servicos, barbeiros };
}

export async function obterPlanoPublico({ id }) {
  const plano = await planoRepository.buscarPlanoPorId(id);
  if (!plano || !plano.ativo || !plano.adesoes_abertas)
    throw new AppError('Plano não encontrado.', 404, 'PLAN_NOT_FOUND');
  const [servicos, barbeiros] = await Promise.all([
    planoRepository.listarServicosDoPlano(id),
    planoRepository.listarBarbeirosDoPlano(id),
  ]);
  return {
    id: plano.id,
    nome: plano.nome,
    descricao: plano.descricao,
    preco: plano.preco,
    adesaoInicio: plano.adesao_inicio,
    adesaoFim: plano.adesao_fim,
    utilizacaoInicio: plano.utilizacao_inicio,
    utilizacaoFim: plano.utilizacao_fim,
    possuiLimiteSemanal: plano.possui_limite_semanal,
    limiteSemanal: plano.limite_semanal,
    possuiLimiteTotal: plano.possui_limite_total,
    limiteTotal: plano.limite_total,
    servicos,
    barbeiros,
  };
}

export async function listarPlanosAdmin({ query }) {
  const pagination = parsePagination(query, allowedSorts, 'id');
  const result = await planoRepository.listarPlanosAdmin({
    search: query.search?.trim() ?? '',
    ativo: query.ativo,
    adesoesAbertas: query.adesoesAbertas,
    usoStatus: query.usoStatus,
    date: query.date,
    pagination,
  });
  return paginationResult(result.rows, result.total, pagination);
}

export async function listarPlanosPublicos({ query }) {
  const pagination = parsePagination(query, allowedSorts, 'nome');
  const result = await planoRepository.listarPlanosPublicos({
    search: query.search?.trim() ?? '',
    date: query.date,
    pagination,
  });
  return paginationResult(result.rows, result.total, pagination);
}
