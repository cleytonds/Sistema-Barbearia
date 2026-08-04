import { api } from '../api/client.js';
export const barbeiroService = {
  listPublic: async (p = {}) => (await api.get('/barbeiros', { params: p })).data,
  getPublic: async (id) => (await api.get(`/barbeiros/${id}`)).data,
  listAdmin: async (p) => (await api.get('/admin/barbeiros', { params: p })).data,
  create: async (d) => (await api.post('/admin/barbeiros', d)).data,
  update: async (id, d) => (await api.put(`/admin/barbeiros/${id}`, d)).data,
  syncServices: async (id, servicoIds) =>
    (await api.put(`/admin/barbeiros/${id}/servicos`, { servicoIds })).data,
};
