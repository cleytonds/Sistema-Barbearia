import { api } from '../api/client.js';
export const operacionalService = {
  publicConfig: async () => (await api.get('/configuracoes/publicas')).data,
  publicHours: async () => (await api.get('/configuracoes/horarios')).data,
  adminConfig: async () => (await api.get('/admin/configuracoes')).data,
  updateConfig: async (d) => (await api.put('/admin/configuracoes', d)).data,
  updateBusinessHours: async (dias) =>
    (await api.put('/admin/horarios-funcionamento', { dias })).data,
  myHours: async () => (await api.get('/barbeiro/me/horarios')).data,
  myBlocks: async () => (await api.get('/barbeiro/me/bloqueios')).data,
  barberDashboard: async (data, signal) =>
    (await api.get('/barbeiro/dashboard', { params: { data }, signal })).data,
  barberAppointments: async (params, signal) =>
    (await api.get('/barbeiro/agendamentos', { params, signal })).data,
  barberAppointment: async (id, signal) =>
    (await api.get(`/barbeiro/agendamentos/${id}`, { signal })).data,
  updateAppointmentStatus: async (id, status, justificativa) =>
    (await api.put(`/barbeiro/agendamentos/${id}/status`, { status, justificativa })).data,
  archiveAppointment: async (id) => api.put(`/barbeiro/agendamentos/${id}/arquivar`),
  myProfile: async () => (await api.get('/barbeiro/me')).data,
  updateMyProfile: async (data) => (await api.put('/barbeiro/me', data)).data,
  myServices: async () => (await api.get('/barbeiro/me/servicos')).data,
  myBlocksFiltered: async (params) => (await api.get('/barbeiro/me/bloqueios', { params })).data,
  createMyBlock: async (data) => (await api.post('/barbeiro/me/bloqueios', data)).data,
  removeMyBlock: async (id) => api.delete(`/barbeiro/me/bloqueios/${id}`),
};
