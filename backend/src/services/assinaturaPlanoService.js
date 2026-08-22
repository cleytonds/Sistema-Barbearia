import { createHash } from 'node:crypto';
import { runTransactionWithRetry } from '../database/transactionRetry.js';
import {
  assertSubscriptionTransition,
  assertPeriod,
  civilDate,
  isInPeriod,
} from '../domain/plans/rules.js';
import { IDEMPOTENCY_KEY_MAX_LENGTH, IDEMPOTENCY_KEY_MIN_LENGTH } from '../config/httpConfig.js';
import { SUBSCRIPTION_STATUS } from '../domain/plans/constants.js';
import * as assinaturaPlanoRepository from '../repositories/assinaturaPlanoRepository.js';
import * as operacionalRepository from '../repositories/operacionalRepository.js';
import * as planoRepository from '../repositories/planoRepository.js';
import * as usoPlanoRepository from '../repositories/usoPlanoRepository.js';
import * as historicoPlanoRepository from '../repositories/historicoPlanoRepository.js';
import { AppError } from '../utils/AppError.js';
import { civilDateAt, isValidTimeZone } from '../utils/dateTime.js';
import { paginationResult, parsePagination } from '../utils/pagination.js';

const IDEMPOTENCY_KEY_PATTERN = new RegExp(
  `^[\\x21-\\x7e]{${IDEMPOTENCY_KEY_MIN_LENGTH},${IDEMPOTENCY_KEY_MAX_LENGTH}}$`,
);

const allowedSorts = {
  id: 'a.id',
  status: 'a.status',
  criado_em: 'a.criado_em',
  inicio_em: 'a.inicio_em',
  fim_em: 'a.fim_em',
};

const hash = (value) => createHash('sha256').update(value).digest();

function toCivilDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

function validateIdempotencyKey(key) {
  if (typeof key !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new AppError('Idempotency-Key obrigatório ou inválida.', 422, 'IDEMPOTENCY_KEY_REQUIRED');
  }
  return key;
}

function buildIdempotency({ key, clientId, planoId }) {
  validateIdempotencyKey(key);
  const canonical = JSON.stringify({
    clientId: String(clientId),
    planoId: String(planoId),
  });
  return { keyHash: hash(key), payloadHash: hash(canonical) };
}

function sameHash(left, right) {
  return Buffer.isBuffer(left) && Buffer.isBuffer(right) && left.equals(right);
}

function isIdempotencyDuplicate(error) {
  return (
    error?.code === 'ER_DUP_ENTRY' && String(error?.message).includes('uq_assinaturas_idempotencia')
  );
}

function normalizeSubscriptionPayload(data) {
  return {
    planoId: Number(data.planoId),
    clientId: Number(data.clientId),
    inicioEm: data.inicioEm,
    fimEm: data.fimEm,
    fusoHorario: data.fusoHorario ?? 'America/Recife',
    actorId: Number(data.actorId),
  };
}

function assertSubscriptionIdentity(payload) {
  if (!Number.isInteger(payload.planoId) || payload.planoId <= 0)
    throw new AppError('Plano inválido.', 422, 'PLAN_REQUIRED');
  if (!Number.isInteger(payload.clientId) || payload.clientId <= 0)
    throw new AppError('Cliente inválido.', 422, 'CLIENT_REQUIRED');
  if (!Number.isInteger(payload.actorId) || payload.actorId <= 0)
    throw new AppError('Autor inválido.', 422, 'VALIDATION_ERROR');
}

function assertSubscriptionPayload(payload) {
  assertSubscriptionIdentity(payload);
  if (!civilDate(payload.inicioEm))
    throw new AppError('Data de início inválida.', 422, 'INVALID_CIVIL_DATE');
  if (!civilDate(payload.fimEm))
    throw new AppError('Data de fim inválida.', 422, 'INVALID_CIVIL_DATE');
  assertPeriod({ inicio: payload.inicioEm, fim: payload.fimEm });
  if (!isValidTimeZone(payload.fusoHorario))
    throw new AppError('Fuso horário inválido.', 422, 'INVALID_TIME_ZONE');
}

async function loadSubscribablePlan(planoId, connection) {
  const plano = await planoRepository.buscarPlanoPorIdForUpdate(planoId, connection);
  if (!plano) throw new AppError('Plano não encontrado.', 404, 'PLAN_NOT_FOUND');
  if (!plano.ativo) throw new AppError('Plano não está ativo.', 422, 'PLAN_NOT_ACTIVE');
  if (!plano.adesoes_abertas)
    throw new AppError('Adesões encerradas para este plano.', 422, 'PLAN_ENROLLMENT_CLOSED');
  return plano;
}

async function checkSubscriptionOverlap(clientId, inicioEm, fimEm, connection) {
  const overlapping = await assinaturaPlanoRepository.buscarSobreposicao(
    clientId,
    inicioEm,
    fimEm,
    connection,
  );
  if (overlapping.length > 0)
    throw new AppError(
      'Já existe uma assinatura do cliente no período.',
      409,
      'SUBSCRIPTION_OVERLAP',
    );
}

async function copySnapshotData(planoId, connection) {
  const [servicos, barbeiros] = await Promise.all([
    planoRepository.listarServicosDoPlano(planoId, { connection }),
    planoRepository.listarBarbeirosDoPlano(planoId, connection),
  ]);
  return { servicos, barbeiros };
}

async function createSubscription({
  payload,
  keyHash,
  payloadHash,
  connection,
  evento,
  actorId,
  nowUtc,
  useOfficialPlanPeriod = false,
}) {
  const plano = await loadSubscribablePlan(payload.planoId, connection);
  const effectivePayload = useOfficialPlanPeriod
    ? {
        ...payload,
        inicioEm: toCivilDate(plano.utilizacao_inicio),
        fimEm: toCivilDate(plano.utilizacao_fim),
        fusoHorario: (await operacionalRepository.config(connection)).fuso_horario,
      }
    : payload;
  assertSubscriptionPayload(effectivePayload);
  await assinaturaPlanoRepository.bloquearClienteParaAssinatura(
    effectivePayload.clientId,
    connection,
  );
  const adesaoIni = toCivilDate(plano.adesao_inicio);
  const adesaoFim = toCivilDate(plano.adesao_fim);
  const dataSolicitacao = civilDateAt(nowUtc, effectivePayload.fusoHorario);
  if (!isInPeriod({ date: dataSolicitacao, inicio: adesaoIni, fim: adesaoFim }))
    throw new AppError('Data fora do período de adesão.', 422, 'ENROLLMENT_OUTSIDE_PERIOD');
  await checkSubscriptionOverlap(
    effectivePayload.clientId,
    effectivePayload.inicioEm,
    effectivePayload.fimEm,
    connection,
  );

  const assinaturaId = await assinaturaPlanoRepository.criarAssinatura(
    {
      planId: plano.id,
      clientId: effectivePayload.clientId,
      start: effectivePayload.inicioEm,
      end: effectivePayload.fimEm,
      planName: plano.nome,
      price: plano.preco,
      hasWeekly: plano.possui_limite_semanal,
      weekly: plano.limite_semanal,
      hasTotal: plano.possui_limite_total,
      total: plano.limite_total,
      timezone: effectivePayload.fusoHorario,
      actorId: effectivePayload.actorId,
      keyHash,
      payloadHash,
    },
    connection,
  );

  const { servicos, barbeiros } = await copySnapshotData(plano.id, connection);
  await assinaturaPlanoRepository.inserirServicosSnapshot(assinaturaId, servicos, connection);
  await assinaturaPlanoRepository.inserirBarbeirosSnapshot(assinaturaId, barbeiros, connection);

  await historicoPlanoRepository.registrarEvento(
    {
      subscriptionId: assinaturaId,
      type: evento,
      actorId,
      note: 'Assinatura solicitada',
      after: {
        planoId: plano.id,
        inicioEm: effectivePayload.inicioEm,
        fimEm: effectivePayload.fimEm,
      },
    },
    connection,
  );
  return assinaturaId;
}

export async function solicitarAdesao({
  data,
  actorId,
  idempotencyKey,
  requestId,
  nowUtc = new Date(),
}) {
  const payload = normalizeSubscriptionPayload({ ...data, actorId });
  assertSubscriptionIdentity(payload);
  const idem = buildIdempotency({
    key: idempotencyKey,
    clientId: payload.clientId,
    planoId: payload.planoId,
  });
  const logContext = { requestId, usuarioId: actorId, operation: 'subscription_request' };

  try {
    return await runTransactionWithRetry({
      logContext,
      operation: async ({ connection }) => {
        // Replay idempotente: mesma chave + mesmo payload retorna a assinatura original.
        const existing = await assinaturaPlanoRepository.buscarPorIdempotencyKey(
          payload.clientId,
          idem.keyHash,
          connection,
        );
        if (existing) {
          if (!sameHash(existing.idempotency_payload_hash, idem.payloadHash))
            throw new AppError(
              'Idempotency-Key reutilizada com payload diferente.',
              409,
              'IDEMPOTENCY_KEY_REUSED',
            );
          return { assinaturaId: existing.id, replay: true };
        }
        const assinaturaId = await createSubscription({
          payload,
          keyHash: idem.keyHash,
          payloadHash: idem.payloadHash,
          connection,
          evento: 'assinatura_solicitada',
          actorId: payload.actorId,
          nowUtc,
          useOfficialPlanPeriod: true,
        });
        return { assinaturaId, replay: false };
      },
    });
  } catch (error) {
    if (isIdempotencyDuplicate(error)) {
      // Hash único já inserido por requisição concorrente: consulta o replay após rollback.
      const existing = await assinaturaPlanoRepository.buscarPorIdempotencyKey(
        payload.clientId,
        idem.keyHash,
      );
      if (existing && sameHash(existing.idempotency_payload_hash, idem.payloadHash))
        return { assinaturaId: existing.id, replay: true };
      throw new AppError(
        'Idempotency-Key reutilizada com payload diferente.',
        409,
        'IDEMPOTENCY_KEY_REUSED',
      );
    }
    throw error;
  }
}

export async function criarAssinaturaAdministrativa({
  data,
  actorId,
  requestId,
  nowUtc = new Date(),
}) {
  const payload = normalizeSubscriptionPayload({ ...data, actorId });
  assertSubscriptionIdentity(payload);
  const logContext = { requestId, usuarioId: actorId, operation: 'subscription_create_admin' };
  return runTransactionWithRetry({
    logContext,
    operation: async ({ connection }) => {
      const assinaturaId = await createSubscription({
        payload,
        keyHash: null,
        payloadHash: null,
        connection,
        evento: 'assinatura_solicitada',
        actorId: payload.actorId,
        nowUtc,
        useOfficialPlanPeriod: true,
      });
      return assinaturaId;
    },
  });
}

export async function expirarAssinaturaSeVencida({ id, requestId, nowUtc = new Date() }) {
  return runTransactionWithRetry({
    logContext: { requestId, operation: 'subscription_expire' },
    operation: async ({ connection }) => {
      const assinatura = await assinaturaPlanoRepository.buscarAssinaturaPorIdForUpdate(
        id,
        connection,
      );
      if (!assinatura)
        throw new AppError('Assinatura não encontrada.', 404, 'SUBSCRIPTION_NOT_FOUND');
      if (
        ![SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.SUSPENDED].includes(assinatura.status) ||
        civilDateAt(nowUtc, assinatura.fuso_horario_snapshot) <= toCivilDate(assinatura.fim_em)
      )
        return { assinaturaId: assinatura.id, expirada: false };

      assertSubscriptionTransition(assinatura.status, SUBSCRIPTION_STATUS.EXPIRED);
      await assinaturaPlanoRepository.atualizarStatus(
        assinatura.id,
        SUBSCRIPTION_STATUS.EXPIRED,
        { actorId: assinatura.alterada_por, motivo: null, now: nowUtc },
        connection,
      );
      await historicoPlanoRepository.registrarEvento(
        {
          subscriptionId: assinatura.id,
          type: 'assinatura_vencida',
          actorId: assinatura.alterada_por,
          before: { status: assinatura.status },
          after: { status: SUBSCRIPTION_STATUS.EXPIRED },
        },
        connection,
      );
      return { assinaturaId: assinatura.id, expirada: true };
    },
  });
}

export async function obterAssinaturaAdmin({ id }) {
  let assinatura = await assinaturaPlanoRepository.buscarAssinaturaPorId(id);
  if (!assinatura) throw new AppError('Assinatura não encontrada.', 404, 'SUBSCRIPTION_NOT_FOUND');
  await expirarAssinaturaSeVencida({ id: assinatura.id });
  assinatura = await assinaturaPlanoRepository.buscarAssinaturaPorId(id);
  const [servicos, barbeiros] = await Promise.all([
    assinaturaPlanoRepository.listarServicosSnapshot(id),
    assinaturaPlanoRepository.listarBarbeirosSnapshot(id),
  ]);
  return { ...assinatura, servicos, barbeiros };
}

export async function listarAssinaturasAdmin({ query }) {
  const pagination = parsePagination(query, allowedSorts, 'criado_em');
  const result = await assinaturaPlanoRepository.listarAssinaturasAdmin(
    {
      plano: query.plano,
      cliente: query.cliente,
      status: query.status,
    },
    pagination,
  );
  return paginationResult(result.rows, result.total, pagination);
}

export async function obterMeuPlano({ clientId }) {
  let assinatura = await assinaturaPlanoRepository.buscarMeuPlano(clientId);
  if (!assinatura)
    throw new AppError('Nenhuma assinatura encontrada.', 404, 'SUBSCRIPTION_NOT_FOUND');
  await expirarAssinaturaSeVencida({ id: assinatura.id });
  assinatura = await assinaturaPlanoRepository.buscarMeuPlano(clientId);
  if (!assinatura)
    throw new AppError('Nenhuma assinatura encontrada.', 404, 'SUBSCRIPTION_NOT_FOUND');
  const [servicos, barbeiros] = await Promise.all([
    assinaturaPlanoRepository.listarServicosSnapshot(assinatura.id),
    assinaturaPlanoRepository.listarBarbeirosSnapshot(assinatura.id),
  ]);
  return { ...assinatura, servicos, barbeiros };
}

export async function listarMeusUsos({ clientId, assinaturaId }) {
  const assinatura = await assinaturaPlanoRepository.buscarAssinaturaPorId(assinaturaId);
  if (!assinatura || assinatura.cliente_id !== clientId)
    throw new AppError('Assinatura não encontrada.', 404, 'SUBSCRIPTION_NOT_FOUND');
  const usos = await usoPlanoRepository.listarUsosDaAssinatura(assinaturaId);
  return usos;
}

export async function listarAssinantesDoPlano({ planoId }) {
  await planoServiceExists(planoId);
  return assinaturaPlanoRepository.listarAssinantesDoPlano(planoId);
}

async function planoServiceExists(planoId) {
  const plano = await planoRepository.buscarPlanoPorId(planoId);
  if (!plano) throw new AppError('Plano nÃ£o encontrado.', 404, 'PLAN_NOT_FOUND');
}

export async function listarUsosDaAssinaturaAdmin({ id }) {
  await obterAssinaturaAdmin({ id });
  return usoPlanoRepository.listarUsosDaAssinatura(id);
}

export async function listarHistoricoDaAssinaturaAdmin({ id }) {
  await obterAssinaturaAdmin({ id });
  return historicoPlanoRepository.listarHistoricoDaAssinatura(id);
}

async function mutarStatusAssinatura({ id, status, motivo, actorId, evento, nota, requestId }) {
  if (!motivo?.trim()) throw new AppError('Motivo obrigatório.', 422, 'VALIDATION_ERROR');
  const logContext = { requestId, usuarioId: actorId, operation: 'subscription_status' };
  return runTransactionWithRetry({
    logContext,
    operation: async ({ connection }) => {
      const assinatura = await assinaturaPlanoRepository.buscarAssinaturaPorIdForUpdate(
        id,
        connection,
      );
      if (!assinatura)
        throw new AppError('Assinatura não encontrada.', 404, 'SUBSCRIPTION_NOT_FOUND');
      if (
        status === SUBSCRIPTION_STATUS.ACTIVE &&
        assinatura.status === SUBSCRIPTION_STATUS.SUSPENDED &&
        civilDateAt(new Date(), assinatura.fuso_horario_snapshot) > toCivilDate(assinatura.fim_em)
      )
        throw new AppError(
          'Assinatura vencida não pode ser reativada.',
          409,
          'SUBSCRIPTION_EXPIRED',
        );
      assertSubscriptionTransition(assinatura.status, status);
      await assinaturaPlanoRepository.atualizarStatus(
        id,
        status,
        { actorId, motivo: motivo.trim(), now: new Date() },
        connection,
      );
      await historicoPlanoRepository.registrarEvento(
        {
          subscriptionId: id,
          type: evento,
          actorId,
          note: nota,
          before: { status: assinatura.status },
          after: { status },
        },
        connection,
      );
      return id;
    },
  });
}

export async function suspenderAssinatura({ id, motivo, actorId, requestId }) {
  return mutarStatusAssinatura({
    id,
    status: 'suspensa',
    motivo,
    actorId,
    evento: 'assinatura_suspensa',
    nota: 'Assinatura suspensa',
    requestId,
  });
}

export async function reativarAssinatura({ id, motivo, actorId, requestId }) {
  return mutarStatusAssinatura({
    id,
    status: 'ativa',
    motivo,
    actorId,
    evento: 'assinatura_reativada',
    nota: 'Assinatura reativada',
    requestId,
  });
}

export async function cancelarAssinatura({ id, motivo, actorId, requestId }) {
  return mutarStatusAssinatura({
    id,
    status: 'cancelada',
    motivo,
    actorId,
    evento: 'assinatura_cancelada',
    nota: 'Assinatura cancelada',
    requestId,
  });
}

export async function cancelarMinhaAssinatura({ clientId, motivo, requestId }) {
  if (!motivo?.trim()) throw new AppError('Motivo obrigatório.', 422, 'VALIDATION_ERROR');
  return runTransactionWithRetry({
    logContext: { requestId, usuarioId: clientId, operation: 'subscription_cancel_own' },
    operation: async ({ connection }) => {
      const assinatura = await assinaturaPlanoRepository.buscarMeuPlanoForUpdate(
        clientId,
        connection,
      );
      if (!assinatura)
        throw new AppError('Assinatura não encontrada.', 404, 'SUBSCRIPTION_NOT_FOUND');
      assertSubscriptionTransition(assinatura.status, 'cancelada');
      await assinaturaPlanoRepository.atualizarStatus(
        assinatura.id,
        'cancelada',
        { actorId: clientId, motivo: motivo.trim(), now: new Date() },
        connection,
      );
      await historicoPlanoRepository.registrarEvento(
        {
          subscriptionId: assinatura.id,
          type: 'assinatura_cancelada',
          actorId: clientId,
          note: motivo.trim(),
          before: { status: assinatura.status },
          after: { status: 'cancelada' },
        },
        connection,
      );
      return assinatura.id;
    },
  });
}
