import { pool } from '../config/database.js';

export async function config(connection = pool) {
  const [[configuration]] = await connection.execute('SELECT * FROM configuracoes WHERE id = 1');
  return configuration;
}

export async function businessHours(connection = pool) {
  const [rows] = await connection.execute(
    'SELECT * FROM horarios_funcionamento ORDER BY dia_semana',
  );
  return rows;
}

export async function barberHours(barbeiroId, connection = pool) {
  const [rows] = await connection.execute(
    `
      SELECT *
      FROM horarios_trabalho
      WHERE barbeiro_id = ?
      ORDER BY dia_semana
    `,
    [barbeiroId],
  );
  return rows;
}

/** Lista todos os bloqueios ou limita a consulta à agenda de um barbeiro. */
export async function blocks(
  { barberId = null, all = false, startAt = null, endAt = null, pagination = null },
  connection = pool,
) {
  const conditions = [];
  const parameters = [];
  if (!all) {
    conditions.push('barbeiro_id = ?');
    parameters.push(barberId);
  }
  if (startAt) {
    conditions.push('inicio_em >= ?');
    parameters.push(startAt);
  }
  if (endAt) {
    conditions.push('inicio_em < ?');
    parameters.push(endAt);
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [[count]] = await connection.execute(
    `SELECT COUNT(*) total FROM bloqueios_agenda ${whereClause}`,
    parameters,
  );
  const order = pagination?.order ?? 'ASC';
  const limit = pagination ? `LIMIT ${pagination.limit} OFFSET ${pagination.offset}` : '';
  const [rows] = await connection.execute(
    `
      SELECT id, barbeiro_id, inicio_em, fim_em, motivo, criado_por, criado_em
      FROM bloqueios_agenda
      ${whereClause}
      ORDER BY inicio_em ${order}
      ${limit}
    `,
    parameters,
  );
  return { rows, total: Number(count.total) };
}
