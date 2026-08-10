import { api } from '../api/client.js';

async function listAllPublic(params = {}) {
  const servicesById = new Map();
  let page = 1;
  let totalPages = 1;

  do {
    const response = (await api.get('/servicos', { params: { ...params, page, limit: 100 } })).data;
    for (const service of Array.isArray(response?.data) ? response.data : []) {
      servicesById.set(String(service.id), service);
    }
    totalPages = Math.max(1, Number(response?.pagination?.totalPages) || 1);
    page += 1;
  } while (page <= totalPages);

  return { data: [...servicesById.values()] };
}

export const servicoService = {
  listPublic: async (p) => (await api.get('/servicos', { params: p })).data,
  listAllPublic,
  getPublic: async (id) => (await api.get(`/servicos/${id}`)).data,
  listAdmin: async (p) => (await api.get('/admin/servicos', { params: p })).data,
  create: async (d) => (await api.post('/admin/servicos', d)).data,
  update: async (id, d) => (await api.put(`/admin/servicos/${id}`, d)).data,
  setStatus: async (id, ativo) => (await api.patch(`/admin/servicos/${id}/status`, { ativo })).data,
};
