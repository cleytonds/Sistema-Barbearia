import { DateTime } from 'luxon';

import { pool } from '../config/database.js';
import { buildDailyAvailability } from '../domain/availability/buildDailyAvailability.js';
import { calculateBookingPeriod } from '../domain/availability/bookingPeriod.js';
import { SLOT_INTERVAL_MINUTES } from '../domain/availability/constants.js';
import {
  assertAvailabilityMode,
  AVAILABILITY_MODE,
} from '../domain/availability/validationMode.js';
import { buildWorkingWindow, timeToMinutes } from '../domain/availability/workingWindow.js';
import { isActiveTransactionContext } from '../database/transactionContext.js';
import * as availabilityRepository from '../repositories/disponibilidadeRepository.js';
import { AppError } from '../utils/AppError.js';

function parseBookingDate(date, timeZone, nowUtc, maximumDays) {
  const parsed = DateTime.fromFormat(date, 'yyyy-MM-dd', { zone: timeZone });
  if (!parsed.isValid || parsed.toFormat('yyyy-MM-dd') !== date) {
    throw new AppError('Data de agendamento inválida.', 422, 'INVALID_BOOKING_DATE');
  }
  const today = DateTime.fromJSDate(nowUtc, { zone: timeZone }).startOf('day');
  if (parsed < today) {
    throw new AppError('Data de agendamento inválida.', 422, 'INVALID_BOOKING_DATE');
  }
  if (parsed > today.plus({ days: maximumDays })) {
    throw new AppError('Data além da antecedência permitida.', 422, 'BOOKING_DATE_OUT_OF_RANGE');
  }
  return parsed;
}

function dayPeriod(dateTime) {
  return {
    dayOfWeek: dateTime.weekday % 7,
    startUtc: dateTime.startOf('day').toUTC().toJSDate(),
    endUtc: dateTime.plus({ days: 1 }).startOf('day').toUTC().toJSDate(),
  };
}

function assertCoreContext(context) {
  if (!context.barber) throw new AppError('Barbeiro não encontrado.', 404, 'BARBER_NOT_FOUND');
  if (!context.service) throw new AppError('Serviço não encontrado.', 404, 'SERVICE_NOT_FOUND');
  if (!context.link) {
    throw new AppError('O barbeiro não realiza este serviço.', 422, 'BARBER_SERVICE_NOT_AVAILABLE');
  }
}

function mapBlocks(rows) {
  return rows.map((row) => ({ start: new Date(row.inicio_em), end: new Date(row.fim_em) }));
}

function mapAppointments(rows) {
  return rows.map((row) => ({
    start: new Date(row.inicio_em),
    end: new Date(row.fim_ocupacao_em),
  }));
}

function publicResponse(date, context, horarios) {
  return {
    data: date,
    barbeiro: { id: String(context.barber.id), nome: context.barber.nome },
    servico: {
      id: String(context.service.id),
      nome: context.service.nome,
      duracaoMinutos: context.service.duracao_minutos,
      preco: Number(context.service.preco).toFixed(2),
    },
    fusoHorario: context.settings.fuso_horario,
    horarios,
  };
}

/** Calcula a disponibilidade pública sem adquirir locks. */
export async function listAvailability({ barbeiroId, servicoId, date, nowUtc = new Date() }) {
  const settings = await availabilityRepository.findSettings();
  const parsedDate = parseBookingDate(
    date,
    settings.fuso_horario,
    nowUtc,
    settings.antecedencia_maxima_dias,
  );
  const period = dayPeriod(parsedDate);
  const context = await availabilityRepository.loadAvailabilityContext({
    barbeiroId,
    servicoId,
    ...period,
  });
  assertCoreContext(context);

  if (!context.businessHours?.ativo || !context.barberHours?.ativo) {
    return publicResponse(date, context, []);
  }
  const bufferMinutes = context.settings.intervalo_entre_atendimentos_minutos;
  const horarios = buildDailyAvailability({
    date,
    timeZone: context.settings.fuso_horario,
    businessHours: context.businessHours,
    barberHours: context.barberHours,
    durationMinutes: context.service.duracao_minutos,
    bufferMinutes,
    blocks: mapBlocks(context.blocks),
    appointments: mapAppointments(context.appointments),
    nowUtc,
  });
  return publicResponse(date, context, horarios);
}

/**
 * Revalida um início específico em modo informativo ou sob lock transacional.
 * A função não inicia nem encerra transações; esse ciclo pertence à futura escrita.
 */
export async function validateAvailability({
  barbeiroId,
  servicoId,
  inicioUtc,
  excludeAppointmentId = null,
  connection = pool,
  mode,
  nowUtc,
  bookingSnapshot = null,
}) {
  assertAvailabilityMode(mode);
  let database = connection;
  if (mode === AVAILABILITY_MODE.TRANSACTIONAL) {
    if (!isActiveTransactionContext(connection)) {
      throw new AppError(
        'Conexão transacional obrigatória.',
        500,
        'TRANSACTION_CONNECTION_REQUIRED',
      );
    }
    database = connection.connection;
    const locked = await availabilityRepository.lockBarber(barbeiroId, database);
    if (!locked) throw new AppError('Barbeiro não encontrado.', 404, 'BARBER_NOT_FOUND');
  }

  const settings = await availabilityRepository.findSettings(database, {
    snapshotProvided: bookingSnapshot != null,
  });
  const localStart = DateTime.fromJSDate(inicioUtc, { zone: settings.fuso_horario });
  const date = localStart.toFormat('yyyy-MM-dd');
  const parsedDate = parseBookingDate(
    date,
    settings.fuso_horario,
    nowUtc,
    settings.antecedencia_maxima_dias,
  );
  const period = dayPeriod(parsedDate);
  const context = await availabilityRepository.loadAvailabilityContext(
    { barbeiroId, servicoId, excludeAppointmentId, ...period },
    database,
    {
      parallel: mode === AVAILABILITY_MODE.READ_ONLY && database === pool,
      bookingSnapshot,
    },
  );
  assertCoreContext(context);
  if (!context.businessHours?.ativo) {
    throw new AppError('Barbearia fechada.', 422, 'BUSINESS_CLOSED');
  }
  if (!context.barberHours?.ativo) {
    throw new AppError('Barbeiro sem jornada.', 422, 'BARBER_NOT_WORKING');
  }

  const localMinute = localStart.hour * 60 + localStart.minute;
  if (localStart.second !== 0 || localMinute % SLOT_INTERVAL_MINUTES !== 0) {
    throw new AppError('Horário indisponível.', 409, 'AVAILABILITY_CHANGED');
  }
  const durationMinutes = bookingSnapshot?.durationMinutes ?? context.service.duracao_minutos;
  const bufferMinutes =
    bookingSnapshot?.bufferMinutes ?? context.settings.intervalo_entre_atendimentos_minutos;
  const available = buildDailyAvailability({
    date,
    timeZone: settings.fuso_horario,
    businessHours: context.businessHours,
    barberHours: context.barberHours,
    durationMinutes,
    bufferMinutes,
    blocks: mapBlocks(context.blocks),
    appointments: mapAppointments(context.appointments),
    nowUtc,
  }).some((slot) => slot.inicioLocal === localStart.toFormat('HH:mm'));
  if (!available) throw new AppError('Disponibilidade alterada.', 409, 'AVAILABILITY_CHANGED');

  const bookingPeriod = calculateBookingPeriod({
    startUtc: inicioUtc,
    durationMinutes,
    bufferMinutes,
  });
  return {
    available: true,
    serviceEndUtc: bookingPeriod.serviceEndUtc,
    occupiedUntilUtc: bookingPeriod.occupiedUntilUtc,
    serviceDurationMinutes: durationMinutes,
    bufferMinutes,
    servicePrice: context.service.preco,
  };
}

export { AVAILABILITY_MODE, buildWorkingWindow, parseBookingDate, timeToMinutes };
