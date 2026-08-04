export const appointmentStatus = {
  pendente: { label: 'Pendente', description: 'Aguardando confirmação.', tone: 'warning' },
  confirmado: { label: 'Confirmado', description: 'Horário confirmado.', tone: 'success' },
  em_atendimento: {
    label: 'Em atendimento',
    description: 'Atendimento em andamento.',
    tone: 'info',
  },
  concluido: { label: 'Concluído', description: 'Atendimento concluído.', tone: 'success' },
  cancelado: { label: 'Cancelado', description: 'Agendamento cancelado.', tone: 'error' },
  ausente: { label: 'Ausente', description: 'Cliente não compareceu.', tone: 'warning' },
};
