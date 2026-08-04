import { pool } from '../config/database.js';
import { ACTIVE_APPOINTMENT_STATUSES } from '../domain/availability/constants.js';

export async function findSettings(connection = pool) {
  const [[settings]] = await connection.execute(
    `
      SELECT
        fuso_horario,
        antecedencia_maxima_dias,
        intervalo_entre_atendimentos_minutos
      FROM configuracoes
      WHERE id = 1
    `,
  );
  return settings ?? null;
}

export async function findActiveBarber(barbeiroId, connection = pool) {
  const [[barber]] = await connection.execute(
    `
      SELECT b.id, u.nome
      FROM barbeiros b
      INNER JOIN usuarios u ON u.id = b.usuario_id
      WHERE b.id = ?
        AND b.ativo = TRUE
        AND u.ativo = TRUE
      LIMIT 1
    `,
    [barbeiroId],
  );
  return barber ?? null;
}

export async function findActiveService(servicoId, connection = pool) {
  const [[service]] = await connection.execute(
    `
      SELECT id, nome, preco, duracao_minutos
      FROM servicos
      WHERE id = ? AND ativo = TRUE
      LIMIT 1
    `,
    [servicoId],
  );
  return service ?? null;
}

export async function findBarberServiceLink(barbeiroId, servicoId, connection = pool) {
  const [[link]] = await connection.execute(
    `
      SELECT id
      FROM barbeiro_servicos
      WHERE barbeiro_id = ? AND servico_id = ?
      LIMIT 1
    `,
    [barbeiroId, servicoId],
  );
  return link ?? null;
}

export async function findBusinessHours(dayOfWeek, connection = pool) {
  const [[hours]] = await connection.execute(
    'SELECT * FROM horarios_funcionamento WHERE dia_semana = ? LIMIT 1',
    [dayOfWeek],
  );
  return hours ?? null;
}

export async function findBarberWorkingHours(barbeiroId, dayOfWeek, connection = pool) {
  const [[hours]] = await connection.execute(
    `
      SELECT *
      FROM horarios_trabalho
      WHERE barbeiro_id = ? AND dia_semana = ?
      LIMIT 1
    `,
    [barbeiroId, dayOfWeek],
  );
  return hours ?? null;
}

export async function findBlocksForPeriod({ barbeiroId, startUtc, endUtc }, connection = pool) {
  const [rows] = await connection.execute(
    `
      SELECT inicio_em, fim_em
      FROM bloqueios_agenda
      WHERE (barbeiro_id = ? OR barbeiro_id IS NULL)
        AND inicio_em < ?
        AND fim_em > ?
      ORDER BY inicio_em
    `,
    [barbeiroId, endUtc, startUtc],
  );
  return rows;
}

export async function findAppointmentsForPeriod(
  { barbeiroId, startUtc, endUtc, excludeAppointmentId = null },
  connection = pool,
) {
  const statusPlaceholders = ACTIVE_APPOINTMENT_STATUSES.map(() => '?').join(', ');
  const exclusion = excludeAppointmentId == null ? '' : 'AND id <> ?';
  const parameters = [barbeiroId, ...ACTIVE_APPOINTMENT_STATUSES, endUtc, startUtc];
  if (excludeAppointmentId != null) parameters.push(excludeAppointmentId);

  const [rows] = await connection.execute(
    `
      SELECT inicio_em, fim_em, status
      FROM agendamentos
      WHERE barbeiro_id = ?
        AND status IN (${statusPlaceholders})
        AND inicio_em < ?
        AND fim_em > ?
        ${exclusion}
      ORDER BY inicio_em
    `,
    parameters,
  );
  return rows;
}

/** O lock do barbeiro funciona como mutex lógico para todas as escritas da agenda. */
export async function lockBarber(barbeiroId, connection) {
  const [[barber]] = await connection.execute('SELECT id FROM barbeiros WHERE id=? FOR UPDATE', [
    barbeiroId,
  ]);
  return barber ?? null;
}

/**
 * Carrega o contexto diário sem incluir regras de geração de slots.
 * Consultas independentes usam paralelismo apenas no modo informativo.
 */
export async function loadAvailabilityContext(
  { barbeiroId, servicoId, dayOfWeek, startUtc, endUtc, excludeAppointmentId },
  connection = pool,
  { parallel = connection === pool } = {},
) {
  const tasks = [
    () => findSettings(connection),
    () => findActiveBarber(barbeiroId, connection),
    () => findActiveService(servicoId, connection),
    () => findBarberServiceLink(barbeiroId, servicoId, connection),
    () => findBusinessHours(dayOfWeek, connection),
    () => findBarberWorkingHours(barbeiroId, dayOfWeek, connection),
    () => findBlocksForPeriod({ barbeiroId, startUtc, endUtc }, connection),
    () =>
      findAppointmentsForPeriod({ barbeiroId, startUtc, endUtc, excludeAppointmentId }, connection),
  ];
  const results = parallel
    ? await Promise.all(tasks.map((task) => task()))
    : await tasks.reduce(async (valuesPromise, task) => {
        const values = await valuesPromise;
        values.push(await task());
        return values;
      }, Promise.resolve([]));
  const [settings, barber, service, link, businessHours, barberHours, blocks, appointments] =
    results;
  return { settings, barber, service, link, businessHours, barberHours, blocks, appointments };
}
