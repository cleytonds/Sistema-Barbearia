import { pool } from '../config/database.js';

const detail = `SELECT a.*, p.uso_status, u.nome AS cliente_nome
  FROM assinaturas_planos a
  JOIN planos p ON p.id = a.plano_id
  JOIN usuarios u ON u.id = a.cliente_id`;

export async function buscarAssinaturaPorId(id, connection = pool) {
  const [[row]] = await connection.execute(`${detail} WHERE a.id = ? LIMIT 1`, [id]);
  return row ?? null;
}

export async function buscarAssinaturaPorIdForUpdate(id, connection) {
  const [[row]] = await connection.execute(`${detail} WHERE a.id = ? LIMIT 1 FOR UPDATE`, [id]);
  return row ?? null;
}

export async function buscarAssinaturaAtivaDoCliente(
  clienteId,
  date,
  connection = pool,
  lock = false,
) {
  const [[row]] = await connection.execute(
    `${detail} WHERE a.cliente_id = ? AND a.status = 'ativa'
     AND a.inicio_em <= ? AND a.fim_em >= ?
     ORDER BY a.inicio_em DESC LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    [clienteId, date, date],
  );
  return row ?? null;
}

export async function buscarAssinaturasDoClienteNoPeriodoForUpdate(
  clienteId,
  inicio,
  fim,
  connection,
) {
  const [rows] = await connection.execute(
    `SELECT a.id FROM assinaturas_planos a
     WHERE a.cliente_id = ? AND a.status IN ('aguardando_pagamento', 'ativa', 'suspensa')
     AND a.inicio_em <= ? AND a.fim_em >= ? FOR UPDATE`,
    [clienteId, fim, inicio],
  );
  return rows;
}

export async function buscarAssinaturasAtivasDoCliente(clienteId, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT a.id FROM assinaturas_planos a
     WHERE a.cliente_id = ? AND a.status NOT IN ('vencida', 'cancelada')`,
    [clienteId],
  );
  return rows;
}

export async function buscarSobreposicao(clienteId, inicio, fim, connection) {
  const [rows] = await connection.execute(
    `SELECT a.id FROM assinaturas_planos a
     WHERE a.cliente_id = ? AND a.status IN ('aguardando_pagamento', 'ativa', 'suspensa')
     AND a.inicio_em <= ? AND a.fim_em >= ?`,
    [clienteId, fim, inicio],
  );
  return rows;
}

export async function bloquearClienteParaAssinatura(clienteId, connection) {
  await connection.execute('SELECT id FROM usuarios WHERE id = ? FOR UPDATE', [clienteId]);
}

export async function criarAssinatura(data, connection) {
  const [result] = await connection.execute(
    `INSERT INTO assinaturas_planos (
       plano_id, cliente_id, inicio_em, fim_em, plano_nome_snapshot,
       valor_contratado, possui_limite_semanal_snapshot, limite_semanal_snapshot,
       possui_limite_total_snapshot, limite_total_snapshot, fuso_horario_snapshot,
       alterada_por, idempotency_key_hash, idempotency_payload_hash
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.planId,
      data.clientId,
      data.start,
      data.end,
      data.planName,
      data.price,
      data.hasWeekly,
      data.weekly,
      data.hasTotal,
      data.total,
      data.timezone,
      data.actorId,
      data.keyHash,
      data.payloadHash,
    ],
  );
  return result.insertId;
}

const allowedStatusFields = {
  ativa: 'ativada_em',
  suspensa: 'suspensa_em',
  cancelada: 'cancelada_em',
};

export async function atualizarStatus(id, status, { actorId, motivo, now }, connection) {
  const timestampField = allowedStatusFields[status] ?? null;
  const parameters = [status, motivo ?? null, actorId];
  let setSql = 'status = ?, motivo_status = ?, alterada_por = ?';
  if (timestampField) {
    setSql += `, ${timestampField} = ?`;
    parameters.push(now);
  }
  if (status === 'ativa') {
    setSql += ', suspensa_em = NULL';
  }
  parameters.push(id);
  await connection.execute(`UPDATE assinaturas_planos SET ${setSql} WHERE id = ?`, parameters);
}

export async function listarAssinaturasAdmin(filters, pagination, connection = pool) {
  const conditions = [];
  const parameters = [];
  if (filters.plano) {
    conditions.push('a.plano_id = ?');
    parameters.push(filters.plano);
  }
  if (filters.cliente) {
    conditions.push('a.cliente_id = ?');
    parameters.push(filters.cliente);
  }
  if (filters.status) {
    conditions.push('a.status = ?');
    parameters.push(filters.status);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [[count]] = await connection.execute(
    `SELECT COUNT(*) AS total FROM assinaturas_planos a ${where}`,
    parameters,
  );
  const [rows] = await connection.execute(
    `${detail} ${where}
     ORDER BY ${pagination.sortColumn} ${pagination.order}
     LIMIT ${pagination.limit} OFFSET ${pagination.offset}`,
    parameters,
  );
  return { rows, total: Number(count.total) };
}

export async function listarAssinantesDoPlano(planoId, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT a.id, a.cliente_id, u.nome AS cliente_nome, a.status, a.inicio_em, a.fim_em
     FROM assinaturas_planos a JOIN usuarios u ON u.id = a.cliente_id
     WHERE a.plano_id = ? ORDER BY a.criado_em DESC`,
    [planoId],
  );
  return rows;
}

export async function listarServicosSnapshot(assinaturaId, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT servico_id AS id, servico_nome_snapshot AS nome
     FROM assinatura_plano_servicos WHERE assinatura_id = ? ORDER BY servico_nome_snapshot`,
    [assinaturaId],
  );
  return rows;
}

export async function listarBarbeirosSnapshot(assinaturaId, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT barbeiro_id AS id, barbeiro_nome_snapshot AS nome
     FROM assinatura_plano_barbeiros WHERE assinatura_id = ? ORDER BY barbeiro_nome_snapshot`,
    [assinaturaId],
  );
  return rows;
}

export async function inserirServicosSnapshot(assinaturaId, services, connection) {
  for (const service of services) {
    await connection.execute(
      `INSERT INTO assinatura_plano_servicos (assinatura_id, servico_id, servico_nome_snapshot)
       VALUES (?, ?, ?)`,
      [assinaturaId, service.id, service.nome],
    );
  }
}

export async function inserirBarbeirosSnapshot(assinaturaId, barbers, connection) {
  for (const barber of barbers) {
    await connection.execute(
      `INSERT INTO assinatura_plano_barbeiros (assinatura_id, barbeiro_id, barbeiro_nome_snapshot)
       VALUES (?, ?, ?)`,
      [assinaturaId, barber.id, barber.nome],
    );
  }
}

export async function buscarPorIdempotencyKey(clienteId, keyHash, connection = pool) {
  const [[row]] = await connection.execute(
    `${detail} WHERE a.cliente_id = ? AND a.idempotency_key_hash = ? LIMIT 1`,
    [clienteId, keyHash],
  );
  return row ?? null;
}

export async function salvarHashesIdempotencia(id, { keyHash, payloadHash }, connection) {
  await connection.execute(
    `UPDATE assinaturas_planos SET idempotency_key_hash = ?, idempotency_payload_hash = ?
     WHERE id = ?`,
    [keyHash, payloadHash, id],
  );
}

export async function contarUsos(assinaturaId, connection = pool) {
  const [[row]] = await connection.execute(
    `SELECT COUNT(*) AS total FROM usos_planos
     WHERE assinatura_id = ? AND status IN ('reservado', 'consumido')`,
    [assinaturaId],
  );
  return Number(row.total);
}

export async function buscarMeuPlano(clienteId, connection = pool) {
  const [rows] = await connection.execute(
    `${detail} WHERE a.cliente_id = ?
     AND a.status IN ('aguardando_pagamento', 'ativa', 'suspensa')
     ORDER BY a.criado_em DESC`,
    [clienteId],
  );
  return rows[0] ?? null;
}

export async function buscarMeuPlanoForUpdate(clienteId, connection) {
  const [[row]] = await connection.execute(
    `${detail} WHERE a.cliente_id = ?
     AND a.status IN ('aguardando_pagamento', 'ativa', 'suspensa')
     ORDER BY a.criado_em DESC LIMIT 1 FOR UPDATE`,
    [clienteId],
  );
  return row ?? null;
}

export async function hasService(id, serviceId, connection = pool) {
  const [[row]] = await connection.execute(
    `SELECT 1 AS ok FROM assinatura_plano_servicos WHERE assinatura_id = ? AND servico_id = ?`,
    [id, serviceId],
  );
  return Boolean(row);
}

export async function hasBarber(id, barberId, connection = pool) {
  const [[row]] = await connection.execute(
    `SELECT 1 AS ok FROM assinatura_plano_barbeiros WHERE assinatura_id = ? AND barbeiro_id = ?`,
    [id, barberId],
  );
  return Boolean(row);
}
