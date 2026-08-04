import { pool } from '../config/database.js';

const serviceColumns =
  'id, nome, descricao, preco, duracao_minutos, ativo, criado_em, atualizado_em';

/**
 * Lista serviços com filtros parametrizados e paginação já validada pelo service.
 * Coluna e direção de ordenação vêm de uma allowlist, nunca diretamente do cliente.
 */
export async function listServices(
  { publicOnly = false, search = '', ativo, pagination },
  connection = pool,
) {
  const conditions = [];
  const parameters = [];

  if (publicOnly) conditions.push('ativo = TRUE');
  else if (ativo !== undefined && ativo !== 'all') {
    conditions.push('ativo = ?');
    parameters.push(ativo === 'true');
  }
  if (search) {
    conditions.push('nome LIKE ?');
    parameters.push(`%${search}%`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [[count]] = await connection.execute(
    `SELECT COUNT(*) AS total FROM servicos ${whereClause}`,
    parameters,
  );
  const [rows] = await connection.execute(
    `
      SELECT ${serviceColumns}
      FROM servicos
      ${whereClause}
      ORDER BY ${pagination.sortColumn} ${pagination.order}
      LIMIT ${pagination.limit} OFFSET ${pagination.offset}
    `,
    parameters,
  );
  return { rows, total: count.total };
}

export async function findService(servicoId, connection = pool) {
  const [[service]] = await connection.execute(
    `SELECT ${serviceColumns} FROM servicos WHERE id = ?`,
    [servicoId],
  );
  return service ?? null;
}

export async function createService(data, connection = pool) {
  const [result] = await connection.execute(
    `
      INSERT INTO servicos (nome, descricao, preco, duracao_minutos)
      VALUES (?, ?, ?, ?)
    `,
    [data.nome, data.descricao, data.preco, data.duracao_minutos],
  );
  return findService(result.insertId, connection);
}

export async function updateService(servicoId, data, connection = pool) {
  await connection.execute(
    `
      UPDATE servicos
      SET nome = ?, descricao = ?, preco = ?, duracao_minutos = ?
      WHERE id = ?
    `,
    [data.nome, data.descricao, data.preco, data.duracao_minutos, servicoId],
  );
  return findService(servicoId, connection);
}

export async function updateServiceStatus(servicoId, ativo, connection = pool) {
  await connection.execute('UPDATE servicos SET ativo = ? WHERE id = ?', [ativo, servicoId]);
  return findService(servicoId, connection);
}
