import { api } from '../api/client.js';

/** Serviços públicos do módulo de planos mensais. */
export const planoService = {
  listPublic: async (params) => (await api.get('/planos', { params })).data,
  getPublic: async (id) => (await api.get(`/planos/${id}`)).data,
  sign: async (id, data, key) =>
    (await api.post(`/planos/${id}/assinar`, data, { headers: { 'Idempotency-Key': key } })).data,
  myPlan: async () => (await api.get('/meu-plano')).data,
  myUsages: async () => (await api.get('/meu-plano/usos')).data,
  cancelOwn: async (motivo) => (await api.post('/meu-plano/cancelar', { motivo })).data,
};

/** Serviços administrativos do módulo de planos mensais. */
export const adminPlanoService = {
  listPlanos: async (params) => (await api.get('/admin/planos', { params })).data,
  createPlan: async (data) => (await api.post('/admin/planos', data)).data,
  updatePlan: async (id, data) => (await api.put(`/admin/planos/${id}`, data)).data,
  updatePlanStatus: async (id, acao, motivo) =>
    (await api.patch(`/admin/planos/${id}/status`, { acao, motivo })).data,
  listAssinaturas: async (params) => (await api.get('/admin/assinaturas', { params })).data,
  createAssinatura: async (data) => (await api.post('/admin/assinaturas', data)).data,
  updateAssinaturaStatus: async (id, acao, motivo) =>
    (await api.patch(`/admin/assinaturas/${id}/status`, { acao, motivo })).data,
};
