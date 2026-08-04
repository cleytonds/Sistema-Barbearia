import { api } from '../api/client.js';
export const adminService = {
  dashboard: async (data) => (await api.get('/admin/dashboard', { params: { data } })).data,
  appointments: async (params) => (await api.get('/admin/agendamentos', { params })).data,
  appointment: async (id) => (await api.get(`/admin/agendamentos/${id}`)).data,
  createAppointment: async (data, key) =>
    (await api.post('/admin/agendamentos', data, { headers: { 'Idempotency-Key': key } })).data,
  appointmentStatus: async (id, status, justificativa) =>
    (await api.put(`/admin/agendamentos/${id}/status`, { status, justificativa })).data,
  cancelAppointment: async (id, motivo) =>
    (await api.put(`/admin/agendamentos/${id}/cancelar`, { motivo })).data,
  rescheduleAppointment: async (id, data) =>
    (await api.put(`/admin/agendamentos/${id}/reagendar`, data)).data,
  clients: async (params) => (await api.get('/admin/clientes', { params })).data,
  clientHistory: async (id, params) =>
    (await api.get(`/admin/clientes/${id}/agendamentos`, { params })).data,
  barber: async (id) => (await api.get(`/admin/barbeiros/${id}`)).data,
  barberServices: async (id) => (await api.get(`/admin/barbeiros/${id}/servicos`)).data,
  setBarberStatus: async (id, ativo) =>
    (await api.patch(`/admin/barbeiros/${id}/status`, { ativo })).data,
  barberHours: async (id) => (await api.get(`/admin/barbeiros/${id}/horarios`)).data,
  updateBarberHours: async (id, dias) =>
    (await api.put(`/admin/barbeiros/${id}/horarios`, { dias })).data,
  businessHours: async () => (await api.get('/admin/horarios-funcionamento')).data,
  blocks: async (params) => (await api.get('/admin/bloqueios', { params })).data,
  createBlock: async (data) => (await api.post('/admin/bloqueios', data)).data,
  removeBlock: async (id) => api.delete(`/admin/bloqueios/${id}`),
};
