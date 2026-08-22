import { api } from '../api/client.js';

const value = (source, camel, snake) => source?.[camel] ?? source?.[snake] ?? null;
const list = (items) => (Array.isArray(items) ? items : []);

export function normalizePlan(plan) {
  if (!plan || typeof plan !== 'object') return null;
  return {
    ...plan,
    adesaoInicio: value(plan, 'adesaoInicio', 'adesao_inicio'),
    adesaoFim: value(plan, 'adesaoFim', 'adesao_fim'),
    utilizacaoInicio: value(plan, 'utilizacaoInicio', 'utilizacao_inicio'),
    utilizacaoFim: value(plan, 'utilizacaoFim', 'utilizacao_fim'),
    possuiLimiteSemanal: Boolean(value(plan, 'possuiLimiteSemanal', 'possui_limite_semanal')),
    limiteSemanal: value(plan, 'limiteSemanal', 'limite_semanal'),
    possuiLimiteTotal: Boolean(value(plan, 'possuiLimiteTotal', 'possui_limite_total')),
    limiteTotal: value(plan, 'limiteTotal', 'limite_total'),
    adesoesAbertas: Boolean(value(plan, 'adesoesAbertas', 'adesoes_abertas')),
    usoStatus: value(plan, 'usoStatus', 'uso_status'),
    servicos: list(plan.servicos),
    barbeiros: list(plan.barbeiros),
  };
}

export function normalizeSubscription(subscription) {
  if (!subscription || typeof subscription !== 'object') return null;
  return {
    ...subscription,
    planoNomeSnapshot: value(subscription, 'planoNomeSnapshot', 'plano_nome_snapshot'),
    valorContratado: value(subscription, 'valorContratado', 'valor_contratado'),
    inicioEm: value(subscription, 'inicioEm', 'inicio_em'),
    fimEm: value(subscription, 'fimEm', 'fim_em'),
    possuiLimiteTotalSnapshot: Boolean(
      value(subscription, 'possuiLimiteTotalSnapshot', 'possui_limite_total_snapshot'),
    ),
    limiteTotalSnapshot: value(subscription, 'limiteTotalSnapshot', 'limite_total_snapshot'),
    motivoStatus: value(subscription, 'motivoStatus', 'motivo_status'),
    usoStatus: value(subscription, 'usoStatus', 'uso_status'),
    servicos: list(subscription.servicos),
    barbeiros: list(subscription.barbeiros),
  };
}

function normalizeEnvelope(payload, normalizer) {
  if (!payload || typeof payload !== 'object') return { data: null };
  const data = Array.isArray(payload.data)
    ? payload.data.map(normalizer).filter(Boolean)
    : normalizer(payload.data);
  return { ...payload, data };
}

export function normalizePaymentConfirmation(data) {
  const reference = String(data?.referencia ?? '').trim();
  const month = /^\d{4}-\d{2}$/.test(reference)
    ? reference
    : /^\d{4}-\d{2}-01$/.test(reference)
      ? reference.slice(0, 7)
      : null;
  if (!month) throw new Error('Informe a referência no formato mês/ano.');
  const rawValue = String(data?.valor ?? '')
    .trim()
    .replace(',', '.');
  if (!/^(0|[1-9]\d{0,7})(\.\d{1,2})?$/.test(rawValue) || Number(rawValue) <= 0)
    throw new Error('Informe um valor monetário válido.');
  const valor = Number(rawValue).toFixed(2);
  const observacao = String(data?.observacao ?? '').trim();
  return {
    referencia: `${month}-01`,
    valor,
    forma: 'presencial',
    ...(observacao && { observacao }),
  };
}

/** Serviços públicos do módulo de planos mensais. */
export const planoService = {
  listPublic: async (params) =>
    normalizeEnvelope((await api.get('/planos', { params })).data, normalizePlan),
  getPublic: async (id) => normalizeEnvelope((await api.get(`/planos/${id}`)).data, normalizePlan),
  sign: async (id, data, key) =>
    (await api.post(`/planos/${id}/solicitacoes`, data, { headers: { 'Idempotency-Key': key } }))
      .data,
  myPlan: async () => normalizeEnvelope((await api.get('/meu-plano')).data, normalizeSubscription),
  myUsages: async () => (await api.get('/meu-plano/usos')).data,
  cancelOwn: async (motivo) => (await api.post('/meu-plano/cancelar', { motivo })).data,
};

/** Serviços administrativos do módulo de planos mensais. */
export const adminPlanoService = {
  listPlanos: async (params) =>
    normalizeEnvelope((await api.get('/admin/planos', { params })).data, normalizePlan),
  getPlan: async (id) =>
    normalizeEnvelope((await api.get(`/admin/planos/${id}`)).data, normalizePlan),
  createPlan: async (data) =>
    normalizeEnvelope((await api.post('/admin/planos', data)).data, normalizePlan),
  updatePlan: async (id, data) =>
    normalizeEnvelope((await api.put(`/admin/planos/${id}`, data)).data, normalizePlan),
  updatePlanStatus: async (id, acao, motivo) => {
    if (acao === 'ativar' || acao === 'desativar') {
      return (await api.patch(`/admin/planos/${id}/status`, { ativo: acao === 'ativar' })).data;
    }
    if (acao === 'abrir_adesoes' || acao === 'fechar_adesoes') {
      return (
        await api.patch(`/admin/planos/${id}/adesoes`, {
          abertas: acao === 'abrir_adesoes',
        })
      ).data;
    }
    return (
      await api.patch(`/admin/planos/${id}/uso`, {
        permitido: acao === 'permitir_uso',
        ...(motivo && { motivo }),
      })
    ).data;
  },
  listAssinaturas: async (params) => (await api.get('/admin/assinaturas-planos', { params })).data,
  createAssinatura: async (data) => (await api.post('/admin/assinaturas-planos', data)).data,
  confirmAssinaturaPayment: async (id, data) =>
    (
      await api.put(
        `/admin/assinaturas-planos/${id}/confirmar-pagamento`,
        normalizePaymentConfirmation(data),
      )
    ).data,
  updateAssinaturaStatus: async (id, acao, motivo) =>
    (await api.put(`/admin/assinaturas-planos/${id}/${acao}`, { motivo })).data,
};
