import { api } from '../api/client.js';

export const comissaoService = {
  list: async (params) => (await api.get('/admin/comissoes', { params })).data,
  async listAll(params = {}) {
    const first = await this.list({ ...params, page: 1, limit: 100 });
    const rows = [...(first.data ?? [])];
    const pages = first.pagination?.totalPages ?? 1;
    for (let page = 2; page <= pages; page += 1) {
      const response = await this.list({ ...params, page, limit: 100 });
      rows.push(...(response.data ?? []));
    }
    return rows;
  },
  configureBarber: async (barbeiroId, data) =>
    (await api.put(`/admin/barbeiros/${barbeiroId}/comissao`, data)).data,
  configurePlanService: async (planoId, servicoId, valorBase) =>
    (
      await api.put(`/admin/planos/${planoId}/servicos/${servicoId}/comissao`, {
        valorBase,
      })
    ).data,
  markPaid: async (id) => (await api.put(`/admin/comissoes/${id}/pagar`, {})).data,
};
