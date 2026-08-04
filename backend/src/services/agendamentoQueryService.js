import { DateTime } from 'luxon';
import { assertAssignedBarber, assertClientOwner } from '../domain/appointments/permissions.js';
import { serializeAppointment } from '../domain/appointments/serializers.js';
import { clientAppointmentPermissions } from '../domain/appointments/clientPermissions.js';
import * as appointmentRepository from '../repositories/agendamentoRepository.js';
import * as historyRepository from '../repositories/historicoAgendamentoRepository.js';
import { AppError } from '../utils/AppError.js';
import { paginationResult } from '../utils/pagination.js';

function filtersForQuery(query, timeZone, nowUtc = new Date()) {
  const startDate = query.data ?? query.dataInicial;
  const endDate = query.data ?? query.dataFinal;
  return {
    status: query.status,
    serviceId: query.servicoId,
    barberId: query.barbeiroId,
    clientId: query.clienteId,
    origin: query.origem,
    startAt: startDate
      ? DateTime.fromISO(startDate, { zone: timeZone }).startOf('day').toUTC().toJSDate()
      : null,
    endAt: endDate
      ? DateTime.fromISO(endDate, { zone: timeZone })
          .plus({ days: 1 })
          .startOf('day')
          .toUTC()
          .toJSDate()
      : null,
    period: query.periodo === 'todos' ? null : query.periodo,
    nowAt: nowUtc,
  };
}

function serializeForRole(row, role, settings) {
  const serialized = serializeAppointment(row, row.fuso_horario);
  if (role === 'barbeiro') return { ...serialized, cliente: { nome: row.cliente_nome } };
  if (role === 'admin') {
    return {
      ...serialized,
      cliente: { id: String(row.cliente_id), nome: row.cliente_nome },
      origem: row.origem,
    };
  }
  return { ...serialized, ...clientAppointmentPermissions(row, settings) };
}

async function list(filters, pagination, role, settings) {
  const [rows, total] = await Promise.all([
    appointmentRepository.list(filters, pagination),
    appointmentRepository.count(filters),
  ]);
  return paginationResult(
    rows.map((row) => serializeForRole(row, role, settings)),
    total,
    pagination,
  );
}

export async function listClient(userId, query, pagination) {
  const settings = await appointmentRepository.findSettings();
  return list(
    { ...filtersForQuery(query, settings.fuso_horario), clientId: userId },
    pagination,
    'cliente',
    settings,
  );
}

export async function listBarber(userId, query, pagination) {
  const barber = await appointmentRepository.findBarberByUser(userId);
  if (!barber?.ativo) throw new AppError('Barbeiro não encontrado.', 404, 'BARBER_NOT_FOUND');
  const settings = await appointmentRepository.findSettings();
  return list(
    { ...filtersForQuery(query, settings.fuso_horario), barberId: barber.id },
    pagination,
    'barbeiro',
    settings,
  );
}

export async function listAdmin(query, pagination) {
  const settings = await appointmentRepository.findSettings();
  return list(filtersForQuery(query, settings.fuso_horario), pagination, 'admin', settings);
}

export async function detail({ id, userId, role }) {
  const appointment = await appointmentRepository.findById(id);
  if (!appointment) throw new AppError('Agendamento não encontrado.', 404, 'APPOINTMENT_NOT_FOUND');
  if (role === 'cliente') assertClientOwner(appointment, userId);
  if (role === 'barbeiro') {
    const barber = await appointmentRepository.findBarberByUser(userId);
    assertAssignedBarber(appointment, barber);
  }
  const serialized = serializeAppointment(appointment, appointment.fuso_horario);
  if (role === 'barbeiro') return { ...serialized, cliente: { nome: appointment.cliente_nome } };
  if (role === 'admin') {
    return {
      ...serialized,
      cliente: { id: String(appointment.cliente_id), nome: appointment.cliente_nome },
      origem: appointment.origem,
      criadoPor: String(appointment.criado_por),
      observacoesInternas: appointment.observacoes_internas,
      historico: await historyRepository.listByAppointment(id),
    };
  }
  const settings = await appointmentRepository.findSettings();
  return { ...serialized, ...clientAppointmentPermissions(appointment, settings) };
}
