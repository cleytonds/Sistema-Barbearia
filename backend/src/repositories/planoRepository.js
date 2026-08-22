import { pool } from '../config/database.js';

const planoCols = `p.id, p.nome, p.descricao, CAST(p.preco AS CHAR) AS preco,
  p.adesao_inicio, p.adesao_fim, p.utilizacao_inicio, p.utilizacao_fim,
  p.possui_limite_semanal, p.limite_semanal, p.possui_limite_total, p.limite_total,
  p.ativo, p.adesoes_abertas, p.uso_status, p.uso_suspensao_motivo,
  p.uso_suspenso_por, p.uso_suspenso_em, p.criado_por, p.atualizado_por,
  p.criado_em, p.atualizado_em`;

const selectComCriador = `SELECT ${planoCols}, u.nome AS criado_por_nome
  FROM planos p JOIN usuarios u ON u.id = p.criado_por`;

export async function buscarPlanoPorId(id, connection = pool) {
  const [[row]] = await connection.execute(`${selectComCriador} WHERE p.id = ? LIMIT 1`, [id]);
  return row ?? null;
}

export async function buscarPlanoPorIdForUpdate(id, connection) {
  const [[row]] = await connection.execute(
    `${selectComCriador} WHERE p.id = ? LIMIT 1 FOR UPDATE`,
    [id],
  );
  return row ?? null;
}

export async function listarPlanosPublicos({ search = '', date, pagination }, connection = pool) {
  const conditions = ['p.ativo = TRUE', 'p.adesoes_abertas = TRUE'];
  const parameters = [];
  if (date) {
    conditions.push('p.adesao_inicio <= ?', 'p.adesao_fim >= ?');
    parameters.push(date, date);
  }
  if (search) {
    conditions.push('p.nome LIKE ?');
    parameters.push(`%${search}%`);
  }
  const where = `WHERE ${conditions.join(' AND ')}`;
  const [[count]] = await connection.execute(
    `SELECT COUNT(*) AS total FROM planos p ${where}`,
    parameters,
  );
  const [rows] = await connection.execute(
    `${selectComCriador} ${where}
     ORDER BY ${pagination.sortColumn} ${pagination.order}
     LIMIT ${pagination.limit} OFFSET ${pagination.offset}`,
    parameters,
  );
  return { rows, total: Number(count.total) };
}

export async function listarPlanosAdmin(filters = {}, connection = pool) {
  const conditions = [];
  const parameters = [];
  const { search = '', ativo, adesoesAbertas, usoStatus, date, pagination } = filters;
  if (ativo !== undefined && ativo !== 'all') {
    conditions.push('p.ativo = ?');
    parameters.push(ativo === 'true');
  }
  if (adesoesAbertas !== undefined && adesoesAbertas !== 'all') {
    conditions.push('p.adesoes_abertas = ?');
    parameters.push(adesoesAbertas === 'true');
  }
  if (usoStatus) {
    conditions.push('p.uso_status = ?');
    parameters.push(usoStatus);
  }
  if (date) {
    conditions.push('p.utilizacao_inicio <= ?', 'p.utilizacao_fim >= ?');
    parameters.push(date, date);
  }
  if (search) {
    conditions.push('p.nome LIKE ?');
    parameters.push(`%${search}%`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [[count]] = await connection.execute(
    `SELECT COUNT(*) AS total FROM planos p ${where}`,
    parameters,
  );
  const [rows] = await connection.execute(
    `${selectComCriador} ${where}
     ORDER BY ${pagination.sortColumn} ${pagination.order}
     LIMIT ${pagination.limit} OFFSET ${pagination.offset}`,
    parameters,
  );
  return { rows, total: Number(count.total) };
}

export async function criarPlano(data, connection) {
  const [result] = await connection.execute(
    `INSERT INTO planos (
       nome, descricao, preco, adesao_inicio, adesao_fim,
       utilizacao_inicio, utilizacao_fim,
       possui_limite_semanal, limite_semanal, possui_limite_total, limite_total,
       ativo, adesoes_abertas, criado_por, atualizado_por
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.nome,
      data.descricao,
      data.preco,
      data.adesaoInicio,
      data.adesaoFim,
      data.utilizacaoInicio,
      data.utilizacaoFim,
      data.possuiLimiteSemanal,
      data.limiteSemanal,
      data.possuiLimiteTotal,
      data.limiteTotal,
      data.ativo,
      data.adesoesAbertas,
      data.actorId,
      data.actorId,
    ],
  );
  return result.insertId;
}

export async function atualizarPlano(id, data, connection) {
  await connection.execute(
    `UPDATE planos SET
       nome = ?, descricao = ?, preco = ?, adesao_inicio = ?, adesao_fim = ?,
       utilizacao_inicio = ?, utilizacao_fim = ?,
       possui_limite_semanal = ?, limite_semanal = ?, possui_limite_total = ?,
       limite_total = ?, atualizado_por = ?
     WHERE id = ?`,
    [
      data.nome,
      data.descricao,
      data.preco,
      data.adesaoInicio,
      data.adesaoFim,
      data.utilizacaoInicio,
      data.utilizacaoFim,
      data.possuiLimiteSemanal,
      data.limiteSemanal,
      data.possuiLimiteTotal,
      data.limiteTotal,
      data.actorId,
      id,
    ],
  );
}

const allowedStatusFields = { ativo: 'ativo', adesoes: 'adesoes_abertas' };

export async function atualizarStatus(id, field, value, actorId, connection) {
  const column = allowedStatusFields[field];
  await connection.execute(`UPDATE planos SET ${column} = ?, atualizado_por = ? WHERE id = ?`, [
    value,
    actorId,
    id,
  ]);
}

export async function atualizarAdesoes(id, abertas, actorId, connection) {
  await connection.execute(
    `UPDATE planos SET adesoes_abertas = ?, atualizado_por = ? WHERE id = ?`,
    [abertas, actorId, id],
  );
}

export async function atualizarUso(id, { status, motivo, actorId, now }, connection) {
  await connection.execute(
    `UPDATE planos SET
       uso_status = ?, uso_suspensao_motivo = ?, uso_suspenso_por = ?,
       uso_suspenso_em = ?, atualizado_por = ?
     WHERE id = ?`,
    [
      status,
      status === 'suspenso' ? motivo : null,
      status === 'suspenso' ? actorId : null,
      status === 'suspenso' ? now : null,
      actorId,
      id,
    ],
  );
}

export async function listarServicosDoPlano(
  planoId,
  { includeCommissionBase = false, connection = pool } = {},
) {
  const [rows] = await connection.execute(
    `SELECT ps.servico_id AS id, s.nome${
      includeCommissionBase ? ', CAST(ps.valor_base_comissao AS CHAR) AS valorBaseComissao' : ''
    }
     FROM plano_servicos ps JOIN servicos s ON s.id = ps.servico_id
     WHERE ps.plano_id = ? ORDER BY s.nome`,
    [planoId],
  );
  return rows;
}

export async function listarBarbeirosDoPlano(planoId, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT pb.barbeiro_id AS id, u.nome
     FROM plano_barbeiros pb
     JOIN barbeiros b ON b.id = pb.barbeiro_id
     JOIN usuarios u ON u.id = b.usuario_id
     WHERE pb.plano_id = ? ORDER BY u.nome`,
    [planoId],
  );
  return rows;
}

export async function substituirServicos(planoId, serviceIds, connection) {
  await connection.execute('DELETE FROM plano_servicos WHERE plano_id = ?', [planoId]);
  for (const id of serviceIds) {
    await connection.execute('INSERT INTO plano_servicos (plano_id, servico_id) VALUES (?, ?)', [
      planoId,
      id,
    ]);
  }
}

export async function substituirBarbeiros(planoId, barberIds, connection) {
  await connection.execute('DELETE FROM plano_barbeiros WHERE plano_id = ?', [planoId]);
  for (const id of barberIds) {
    await connection.execute('INSERT INTO plano_barbeiros (plano_id, barbeiro_id) VALUES (?, ?)', [
      planoId,
      id,
    ]);
  }
}

export async function verificarNomeDuplicado(nome, { excludeId, connection = pool } = {}) {
  const conditions = ['nome = ?'];
  const parameters = [nome];
  if (excludeId) {
    conditions.push('id <> ?');
    parameters.push(excludeId);
  }
  const [[row]] = await connection.execute(
    `SELECT id FROM planos WHERE ${conditions.join(' AND ')} LIMIT 1`,
    parameters,
  );
  return row?.id ?? null;
}

export async function contarAssinantes(planoId, connection = pool) {
  const [[row]] = await connection.execute(
    `SELECT COUNT(*) AS total FROM assinaturas_planos
     WHERE plano_id = ? AND status IN ('aguardando_pagamento', 'ativa', 'suspensa')`,
    [planoId],
  );
  return Number(row.total);
}

export async function buscarPlanosPorPeriodo({ inicio, fim, connection = pool }) {
  const [rows] = await connection.execute(
    `SELECT ${planoCols} FROM planos p
     WHERE p.utilizacao_inicio <= ? AND p.utilizacao_fim >= ?`,
    [fim, inicio],
  );
  return rows;
}
