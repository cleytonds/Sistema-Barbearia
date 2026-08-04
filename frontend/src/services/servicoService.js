import { api } from '../api/client.js';
export const servicoService = {
  listPublic: async (p) => (await api.get('/servicos', { params: p })).data,
  getPublic: async (id) => (await api.get(`/servicos/${id}`)).data,
  listAdmin: async (p) => (await api.get('/admin/servicos', { params: p })).data,
  create: async (d) => (await api.post('/admin/servicos', d)).data,
  update: async (id, d) => (await api.put(`/admin/servicos/${id}`, d)).data,
  setStatus: async (id, ativo) => (await api.patch(`/admin/servicos/${id}/status`, { ativo })).data,
};
