import { DateTime } from 'luxon';
import * as appointments from '../repositories/agendamentoRepository.js';
import { AppError } from '../utils/AppError.js';
import { serializeAppointment } from '../domain/appointments/serializers.js';

function bounds(data, zone) {
  const local = DateTime.fromISO(data, { zone });
  if (!local.isValid) throw new AppError('Data inválida.', 422, 'VALIDATION_ERROR');
  return {
    startAt: local.startOf('day').toUTC().toJSDate(),
    endAt: local.plus({ days: 1 }).startOf('day').toUTC().toJSDate(),
  };
}
const number = (value) => Number(value ?? 0);
function totals(row, includeCancelled = false) {
  const result = {
    total: number(row.total),
    pendentes: number(row.pendentes),
    confirmados: number(row.confirmados),
    emAtendimento: number(row.em_atendimento),
    concluidos: number(row.concluidos),
    ausentes: number(row.ausentes),
  };
  if (includeCancelled) result.cancelados = number(row.cancelados);
  return result;
}
export async function barberDashboard(userId, data) {
  const [barber, settings] = await Promise.all([
    appointments.findBarberByUser(userId),
    appointments.findSettings(),
  ]);
  if (!barber?.ativo) throw new AppError('Barbeiro não encontrado.', 404, 'BARBER_NOT_FOUND');
  const period = bounds(data, settings.fuso_horario);
  const result = await appointments.dashboardSummary({ barberId: barber.id, ...period });
  return {
    data,
    ...totals(result.totals),
    proximoAtendimento: result.next
      ? serializeAppointment(result.next, settings.fuso_horario)
      : null,
  };
}
export async function adminDashboard(data) {
  const settings = await appointments.findSettings();
  const period = bounds(data, settings.fuso_horario);
  const [summary, byBarber] = await Promise.all([
    appointments.dashboardSummary(period),
    appointments.dashboardByBarber(period),
  ]);
  return {
    data,
    totais: totals(summary.totals, true),
    proximosAtendimentos: summary.next
      ? [serializeAppointment(summary.next, settings.fuso_horario)]
      : [],
    porBarbeiro: byBarber.map((row) => ({
      barbeiro: { id: String(row.barbeiro_id), nome: row.nome },
      ...totals(row, true),
    })),
  };
}
