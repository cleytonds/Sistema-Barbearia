import { runTransactionWithRetry } from '../database/transactionRetry.js';
import { assertSubscriptionTransition, civilDate } from '../domain/plans/rules.js';
import * as assinaturaRepository from '../repositories/assinaturaPlanoRepository.js';
import * as pagamentoRepository from '../repositories/pagamentoPlanoRepository.js';
import * as historicoRepository from '../repositories/historicoPlanoRepository.js';
import { AppError } from '../utils/AppError.js';
import { isMoney } from '../utils/decimal.js';

function validatePayment(data) {
  if (!civilDate(data.referenciaMes) || !data.referenciaMes.endsWith('-01'))
    throw new AppError('Competência inválida.', 422, 'INVALID_PAYMENT_REFERENCE');
  if (
    !civilDate(data.periodoInicio) ||
    !civilDate(data.periodoFim) ||
    data.periodoFim < data.periodoInicio
  )
    throw new AppError('Período do pagamento inválido.', 422, 'INVALID_PERIOD');
  if (!isMoney(data.valor) || Number(data.valor) <= 0)
    throw new AppError('Valor inválido.', 422, 'INVALID_PAYMENT_VALUE');
  if (data.forma != null && data.forma !== 'presencial')
    throw new AppError('Forma de pagamento inválida.', 422, 'INVALID_PAYMENT_METHOD');
}

export async function criarOuObterPagamentoPendente({ data, actorId, requestId }) {
  validatePayment(data);
  return runTransactionWithRetry({
    logContext: { requestId, usuarioId: actorId, operation: 'plan_payment_create' },
    operation: async ({ connection }) => {
      const subscription = await assinaturaRepository.buscarAssinaturaPorIdForUpdate(
        data.assinaturaId,
        connection,
      );
      if (!subscription)
        throw new AppError('Assinatura não encontrada.', 404, 'SUBSCRIPTION_NOT_FOUND');
      if (['vencida', 'cancelada'].includes(subscription.status))
        throw new AppError('Assinatura não aceita pagamentos.', 409, 'INVALID_SUBSCRIPTION_STATE');
      const existing = await pagamentoRepository.buscarPorAssinaturaEReferenciaForUpdate(
        data.assinaturaId,
        data.referenciaMes,
        connection,
      );
      if (existing) return { pagamento: existing, criado: false };
      const id = await pagamentoRepository.criarPagamentoPendente(
        {
          subscriptionId: data.assinaturaId,
          reference: data.referenciaMes,
          start: data.periodoInicio,
          end: data.periodoFim,
          value: data.valor,
          note: data.observacao?.trim() || null,
        },
        connection,
      );
      await historicoRepository.registrarEvento(
        {
          subscriptionId: data.assinaturaId,
          paymentId: id,
          type: 'pagamento_criado',
          actorId,
          after: { referenciaMes: data.referenciaMes, status: 'pendente' },
        },
        connection,
      );
      return {
        pagamento: await pagamentoRepository.buscarPagamentoPorId(id, connection),
        criado: true,
      };
    },
  });
}

export async function confirmarPagamento({ id, actorId, requestId, now = new Date() }) {
  return runTransactionWithRetry({
    logContext: {
      requestId,
      usuarioId: actorId,
      pagamentoId: id,
      operation: 'plan_payment_confirm',
    },
    operation: async ({ connection }) => {
      const preliminary = await pagamentoRepository.buscarPagamentoPorId(id, connection);
      if (!preliminary) throw new AppError('Pagamento não encontrado.', 404, 'PAYMENT_NOT_FOUND');
      const subscription = await assinaturaRepository.buscarAssinaturaPorIdForUpdate(
        preliminary.assinatura_id,
        connection,
      );
      const payment = await pagamentoRepository.buscarPorAssinaturaEReferenciaForUpdate(
        preliminary.assinatura_id,
        preliminary.referencia_mes,
        connection,
      );
      if (payment.status === 'confirmado') return { pagamento: payment, replay: true };
      if (payment.status === 'cancelado')
        throw new AppError(
          'Pagamento cancelado não pode ser confirmado.',
          409,
          'INVALID_PAYMENT_TRANSITION',
        );
      await pagamentoRepository.confirmarPagamento(id, { actorId, now }, connection);
      await historicoRepository.registrarEvento(
        {
          subscriptionId: subscription.id,
          paymentId: id,
          type: 'pagamento_confirmado',
          actorId,
          after: { status: 'confirmado' },
        },
        connection,
      );
      if (subscription.status === 'aguardando_pagamento') {
        assertSubscriptionTransition(subscription.status, 'ativa');
        await assinaturaRepository.atualizarStatus(
          subscription.id,
          'ativa',
          { actorId, motivo: null, now },
          connection,
        );
        await historicoRepository.registrarEvento(
          {
            subscriptionId: subscription.id,
            paymentId: id,
            type: 'assinatura_ativada',
            actorId,
            after: { status: 'ativa' },
          },
          connection,
        );
      }
      return {
        pagamento: await pagamentoRepository.buscarPagamentoPorId(id, connection),
        replay: false,
      };
    },
  });
}

export async function cancelarPagamento({ id, actorId, motivo, requestId, now = new Date() }) {
  if (!motivo?.trim()) throw new AppError('Motivo obrigatório.', 422, 'VALIDATION_ERROR');
  return runTransactionWithRetry({
    logContext: {
      requestId,
      usuarioId: actorId,
      pagamentoId: id,
      operation: 'plan_payment_cancel',
    },
    operation: async ({ connection }) => {
      const preliminary = await pagamentoRepository.buscarPagamentoPorId(id, connection);
      if (!preliminary) throw new AppError('Pagamento não encontrado.', 404, 'PAYMENT_NOT_FOUND');
      await assinaturaRepository.buscarAssinaturaPorIdForUpdate(
        preliminary.assinatura_id,
        connection,
      );
      const payment = await pagamentoRepository.buscarPorAssinaturaEReferenciaForUpdate(
        preliminary.assinatura_id,
        preliminary.referencia_mes,
        connection,
      );
      if (payment.status === 'cancelado') return { pagamento: payment, replay: true };
      if (payment.status === 'confirmado')
        throw new AppError(
          'Pagamento confirmado não pode ser cancelado.',
          409,
          'INVALID_PAYMENT_TRANSITION',
        );
      await pagamentoRepository.cancelarPagamento(
        id,
        { actorId, now, motivo: motivo.trim() },
        connection,
      );
      await historicoRepository.registrarEvento(
        {
          subscriptionId: preliminary.assinatura_id,
          paymentId: id,
          type: 'pagamento_cancelado',
          actorId,
          note: motivo.trim(),
          after: { status: 'cancelado' },
        },
        connection,
      );
      return {
        pagamento: await pagamentoRepository.buscarPagamentoPorId(id, connection),
        replay: false,
      };
    },
  });
}

export async function listarPagamentos({ assinaturaId }) {
  const subscription = await assinaturaRepository.buscarAssinaturaPorId(assinaturaId);
  if (!subscription)
    throw new AppError('Assinatura não encontrada.', 404, 'SUBSCRIPTION_NOT_FOUND');
  return pagamentoRepository.listarPagamentosDaAssinatura(assinaturaId);
}
