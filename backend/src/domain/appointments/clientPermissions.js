const CLIENT_MUTABLE_STATUSES = new Set(['pendente', 'confirmado']);

/** Calcula permissões do cliente usando o status e o prazo operacional persistidos. */
export function clientAppointmentPermissions(row, settings, now = new Date()) {
  const deadline =
    new Date(row.inicio_em).getTime() - settings.tempo_minimo_cancelamento_horas * 3_600_000;
  const allowed = CLIENT_MUTABLE_STATUSES.has(row.status) && now.getTime() <= deadline;
  return { podeCancelar: allowed, podeReagendar: allowed };
}
