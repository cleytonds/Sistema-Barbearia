import { pool } from '../config/database.js';
import * as op from '../repositories/operacionalRepository.js';
import * as barbers from '../repositories/barbeiroRepository.js';
import { AppError } from '../utils/AppError.js';

function validateWeek(days) {
  if (days.length !== 7 || new Set(days.map((day) => day.diaSemana)).size !== 7)
    throw new AppError(
      'A semana deve conter os sete dias sem duplicidade.',
      422,
      'VALIDATION_ERROR',
    );
}
function minutes(value) {
  const [hours, mins] = value.split(':').map(Number);
  return hours * 60 + mins;
}

export const publicHours = () => op.businessHours();
export const adminHours = () => op.businessHours();
export async function updateBusiness(days) {
  validateWeek(days);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const day of days)
      await connection.execute(
        `INSERT INTO horarios_funcionamento(dia_semana,hora_inicio,hora_fim,intervalo_inicio,intervalo_fim,ativo)VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE hora_inicio=VALUES(hora_inicio),hora_fim=VALUES(hora_fim),intervalo_inicio=VALUES(intervalo_inicio),intervalo_fim=VALUES(intervalo_fim),ativo=VALUES(ativo)`,
        [
          day.diaSemana,
          day.horaInicio,
          day.horaFim,
          day.intervaloInicio ?? null,
          day.intervaloFim ?? null,
          day.ativo,
        ],
      );
    await connection.commit();
    return op.businessHours();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
export const getBarberHours = (id) => op.barberHours(id);
export async function myHours(userId) {
  const barber = await barbers.findBarberByUser(userId);
  if (!barber) throw new AppError('Barbeiro não encontrado.', 404, 'BARBER_NOT_FOUND');
  return op.barberHours(barber.id);
}
export async function updateBarberHours(id, days) {
  validateWeek(days);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('SELECT id FROM barbeiros WHERE id=? FOR UPDATE', [id]);
    const barber = await barbers.findBarber(id, connection);
    if (!barber || !barber.ativo || !barber.usuario_ativo)
      throw new AppError('Barbeiro inativo ou inexistente.', 404, 'BARBER_NOT_FOUND');
    const global = await op.businessHours(connection);
    const map = new Map(global.map((day) => [day.dia_semana, day]));
    for (const day of days) {
      const business = map.get(day.diaSemana);
      const coversBreak =
        !business?.intervalo_inicio ||
        (day.intervaloInicio &&
          day.intervaloFim &&
          minutes(day.intervaloInicio) <= minutes(business.intervalo_inicio) &&
          minutes(day.intervaloFim) >= minutes(business.intervalo_fim));
      if (
        day.ativo &&
        (!business?.ativo ||
          minutes(day.horaInicio) < minutes(business.hora_inicio) ||
          minutes(day.horaFim) > minutes(business.hora_fim) ||
          !coversBreak)
      )
        throw new AppError('Jornada fora do funcionamento.', 422, 'BUSINESS_RULE_VIOLATION');
      await connection.execute(
        `INSERT INTO horarios_trabalho(barbeiro_id,dia_semana,hora_inicio,hora_fim,intervalo_inicio,intervalo_fim,ativo)VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE hora_inicio=VALUES(hora_inicio),hora_fim=VALUES(hora_fim),intervalo_inicio=VALUES(intervalo_inicio),intervalo_fim=VALUES(intervalo_fim),ativo=VALUES(ativo)`,
        [
          id,
          day.diaSemana,
          day.horaInicio,
          day.horaFim,
          day.intervaloInicio ?? null,
          day.intervaloFim ?? null,
          day.ativo,
        ],
      );
    }
    await connection.commit();
    return op.barberHours(id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
