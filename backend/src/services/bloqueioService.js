import { pool } from '../config/database.js';
import * as barbeiroRepository from '../repositories/barbeiroRepository.js';
import * as operacionalRepository from '../repositories/operacionalRepository.js';
import { AppError } from '../utils/AppError.js';
import { isBeforeCurrentLocalMinute, localToUtc } from '../utils/dateTime.js';
import { DateTime } from 'luxon';
import { paginationResult, parsePagination } from '../utils/pagination.js';

function blockFilters(query, timeZone) {
  const pagination = parsePagination(query, { inicio: 'inicio_em' }, 'inicio');
  return {
    startAt: query.dataInicial
      ? DateTime.fromISO(query.dataInicial, { zone: timeZone }).startOf('day').toUTC().toJSDate()
      : null,
    endAt: query.dataFinal
      ? DateTime.fromISO(query.dataFinal, { zone: timeZone })
          .plus({ days: 1 })
          .startOf('day')
          .toUTC()
          .toJSDate()
      : null,
    pagination,
  };
}
export async function listAdmin(query = {}) {
  const configuration = await operacionalRepository.config();
  const filters = blockFilters(query, configuration.fuso_horario);
  const result = await operacionalRepository.blocks({ all: true, ...filters });
  return paginationResult(result.rows, result.total, filters.pagination);
}

export async function listMine(usuarioId, query = {}) {
  const barber = await barbeiroRepository.findBarberByUser(usuarioId);
  if (!barber) throw new AppError('Barbeiro não encontrado.', 404, 'BARBER_NOT_FOUND');
  const configuration = await operacionalRepository.config();
  const filters = blockFilters(query, configuration.fuso_horario);
  const result = await operacionalRepository.blocks({ barberId: barber.id, ...filters });
  return paginationResult(result.rows, result.total, filters.pagination);
}

/**
 * Cria um bloqueio depois de converter o horário local configurado para UTC.
 *
 * O lock específico serializa alterações da agenda do barbeiro. Bloqueios globais
 * bloqueiam todos os barbeiros ativos em ordem crescente para reduzir risco de deadlock.
 * A mesma transação verifica conflitos e insere o bloqueio, fechando a janela de corrida.
 */
async function createBlock({
  barberId,
  inicioLocal,
  fimLocal,
  motivo,
  allowPast = false,
  userId,
  global = false,
}) {
  const configuration = await operacionalRepository.config();
  const startAt = localToUtc(inicioLocal, configuration.fuso_horario);
  const endAt = localToUtc(fimLocal, configuration.fuso_horario);

  if (endAt <= startAt) throw new AppError('Período inválido.', 422, 'VALIDATION_ERROR');
  if (isBeforeCurrentLocalMinute(startAt, configuration.fuso_horario) && !allowPast) {
    throw new AppError('Bloqueio no passado não permitido.', 422, 'BUSINESS_RULE_VIOLATION');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (global) {
      await connection.query('SELECT id FROM barbeiros WHERE ativo = TRUE ORDER BY id FOR UPDATE');
    } else {
      const [[barber]] = await connection.execute(
        'SELECT id FROM barbeiros WHERE id=? AND ativo=TRUE FOR UPDATE',
        [barberId],
      );
      if (!barber) throw new AppError('Barbeiro não encontrado.', 404, 'BARBER_NOT_FOUND');
    }

    const parameters = global ? [endAt, startAt] : [barberId, endAt, startAt];
    const barberFilter = global ? '' : 'barbeiro_id = ? AND ';
    const [conflicts] = await connection.execute(
      `
        SELECT id, inicio_em, fim_em
        FROM agendamentos
        WHERE ${barberFilter}
          status IN ('pendente', 'confirmado', 'em_atendimento')
          AND inicio_em < ?
          AND fim_em > ?
      `,
      parameters,
    );
    if (conflicts.length) {
      throw new AppError('Existem agendamentos conflitantes.', 409, 'SCHEDULE_CONFLICT', conflicts);
    }

    const [result] = await connection.execute(
      `
        INSERT INTO bloqueios_agenda
          (barbeiro_id, inicio_em, fim_em, motivo, criado_por)
        VALUES (?, ?, ?, ?, ?)
      `,
      [global ? null : barberId, startAt, endAt, motivo.trim(), userId],
    );
    await connection.commit();
    return {
      id: String(result.insertId),
      barbeiro_id: global ? null : String(barberId),
      inicio_em: startAt,
      fim_em: endAt,
      motivo,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/** Cria um bloqueio específico ou global no contexto administrativo. */
export async function createAdmin(data, usuarioId) {
  const allowPast = Boolean(data.justificativaPassado);
  return data.barbeiroId == null
    ? createBlock({ global: true, ...data, userId: usuarioId, allowPast })
    : createBlock({ ...data, barberId: data.barbeiroId, userId: usuarioId, allowPast });
}

/** Cria um bloqueio limitado ao perfil profissional autenticado. */
export async function createMine(data, usuarioId) {
  const barber = await barbeiroRepository.findBarberByUser(usuarioId);
  if (!barber || !barber.ativo) {
    throw new AppError('Barbeiro não encontrado.', 404, 'BARBER_NOT_FOUND');
  }
  return createBlock({ ...data, barberId: barber.id, userId: usuarioId });
}

/** Remove fisicamente o bloqueio, respeitando propriedade fora do contexto administrativo. */
export async function remove(bloqueioId, usuarioId, isAdmin) {
  const [[block]] = await pool.execute('SELECT * FROM bloqueios_agenda WHERE id = ?', [bloqueioId]);
  if (!block) throw new AppError('Bloqueio não encontrado.', 404, 'BLOCK_NOT_FOUND');

  if (!isAdmin) {
    const ownBarber = await barbeiroRepository.findBarberByUser(usuarioId);
    const isOwner =
      ownBarber && block.barbeiro_id === ownBarber.id && block.criado_por === usuarioId;
    if (!isOwner) throw new AppError('Acesso não autorizado.', 403, 'FORBIDDEN');
  }
  await pool.execute('DELETE FROM bloqueios_agenda WHERE id = ?', [bloqueioId]);
}
