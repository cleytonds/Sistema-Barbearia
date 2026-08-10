import { pool } from '../config/database.js';

const detailSelect = `
  SELECT a.*, ub.nome AS barbeiro_nome, uc.nome AS cliente_nome,
         s.nome AS servico_nome, c.fuso_horario
  FROM agendamentos a
  INNER JOIN barbeiros b ON b.id = a.barbeiro_id
  INNER JOIN usuarios ub ON ub.id = b.usuario_id
  INNER JOIN usuarios uc ON uc.id = a.cliente_id
  INNER JOIN servicos s ON s.id = a.servico_id
  INNER JOIN configuracoes c ON c.id = 1
`;

export async function findById(id, connection = pool) {
  const [[row]] = await connection.execute(`${detailSelect} WHERE a.id = ? LIMIT 1`, [id]);
  return row ?? null;
}

export async function findByIdWithoutLock(id, connection = pool) {
  const [[row]] = await connection.execute('SELECT * FROM agendamentos WHERE id = ? LIMIT 1', [id]);
  return row ?? null;
}

export async function findByIdForUpdate(id, connection) {
  const [[row]] = await connection.execute(
    'SELECT * FROM agendamentos WHERE id = ? LIMIT 1 FOR UPDATE',
    [id],
  );
  return row ?? null;
}

export async function findByIdempotency({ actorId, origin, keyHash }, connection = pool) {
  const [[row]] = await connection.execute(
    `${detailSelect}
     WHERE a.criado_por = ? AND a.origem = ? AND a.idempotency_key_hash = ? LIMIT 1`,
    [actorId, origin, keyHash],
  );
  return row ?? null;
}

export async function findActiveClient(id, connection = pool) {
  const [[row]] = await connection.execute(
    `SELECT u.id FROM usuarios u
     INNER JOIN usuario_papeis up ON up.usuario_id=u.id
     INNER JOIN papeis p ON p.id=up.papel_id AND p.nome='cliente'
     WHERE u.id = ? AND u.ativo = TRUE LIMIT 1`,
    [id],
  );
  return row ?? null;
}

export async function create(data, connection) {
  const [result] = await connection.execute(
    `INSERT INTO agendamentos (
       cliente_id, barbeiro_id, servico_id, criado_por, origem,
       inicio_em, fim_em, fim_ocupacao_em, preco, duracao_minutos,
       buffer_minutos, status, observacoes_cliente, observacoes_internas,
       idempotency_key_hash, idempotency_payload_hash, tipo_cobranca,
       assinatura_plano_id, plano_id_snapshot, plano_nome_snapshot,
       cobertura_confirmada_em
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.clientId,
      data.barberId,
      data.serviceId,
      data.createdBy,
      data.origin,
      data.snapshot.startAt,
      data.snapshot.endAt,
      data.snapshot.occupiedUntilAt,
      data.snapshot.price,
      data.snapshot.durationMinutes,
      data.snapshot.bufferMinutes,
      data.status,
      data.clientNotes ?? null,
      data.internalNotes ?? null,
      data.keyHash,
      data.payloadHash,
      data.billingType ?? 'avulso',
      data.subscriptionId ?? null,
      data.planId ?? null,
      data.planName ?? null,
      data.coverageConfirmedAt ?? null,
    ],
  );
  return result.insertId;
}

export async function updateCancellation({ id, userId, reason, nowUtc }, connection) {
  await connection.execute(
    `UPDATE agendamentos SET status='cancelado', cancelado_por=?,
       motivo_cancelamento=?, cancelado_em=? WHERE id=?`,
    [userId, reason ?? null, nowUtc, id],
  );
}

export async function updateReschedule({ id, snapshot }, connection) {
  await connection.execute(
    'UPDATE agendamentos SET inicio_em=?, fim_em=?, fim_ocupacao_em=? WHERE id=?',
    [snapshot.startAt, snapshot.endAt, snapshot.occupiedUntilAt, id],
  );
}

export async function updatePlanCoverage({ id, coverage }, connection) {
  await connection.execute(
    `UPDATE agendamentos SET tipo_cobranca=?, assinatura_plano_id=?,
       plano_id_snapshot=?, plano_nome_snapshot=?, cobertura_confirmada_em=? WHERE id=?`,
    [
      coverage.tipoCobranca,
      coverage.assinaturaId ?? null,
      coverage.planoId ?? null,
      coverage.planoNome ?? null,
      coverage.coberturaConfirmadaEm ?? null,
      id,
    ],
  );
}

export async function updateStatus({ id, status, nowUtc }, connection) {
  await connection.execute('UPDATE agendamentos SET status=?, concluido_em=? WHERE id=?', [
    status,
    status === 'concluido' ? nowUtc : null,
    id,
  ]);
}

function filtersSql(filters, parameters) {
  const clauses = [];
  const add = (sql, value) => {
    if (value != null && value !== '') {
      clauses.push(sql);
      parameters.push(value);
    }
  };
  add('a.cliente_id = ?', filters.clientId);
  add('a.barbeiro_id = ?', filters.barberId);
  add('a.servico_id = ?', filters.serviceId);
  add('a.status = ?', filters.status);
  add('a.origem = ?', filters.origin);
  add('a.inicio_em >= ?', filters.startAt);
  add('a.inicio_em < ?', filters.endAt);
  if (filters.period === 'inicio') {
    clauses.push("a.inicio_em >= ? AND a.status IN ('pendente','confirmado','em_atendimento')");
    parameters.push(filters.nowAt);
  }
  if (filters.period === 'historico') {
    clauses.push("(a.inicio_em < ? OR a.status IN ('concluido','cancelado','ausente'))");
    parameters.push(filters.nowAt);
  }
  return clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
}

export async function list(filters, pagination, connection = pool) {
  const parameters = [];
  const where = filtersSql(filters, parameters);
  const [rows] = await connection.query(
    `${detailSelect} ${where}
     ORDER BY ${pagination.sortColumn} ${pagination.order} LIMIT ? OFFSET ?`,
    [...parameters, pagination.limit, pagination.offset],
  );
  return rows;
}

export async function count(filters, connection = pool) {
  const parameters = [];
  const where = filtersSql(filters, parameters);
  const [[row]] = await connection.execute(
    `SELECT COUNT(*) AS total FROM agendamentos a ${where}`,
    parameters,
  );
  return Number(row.total);
}

export async function findBarberByUser(userId, connection = pool) {
  const [[row]] = await connection.execute(
    'SELECT id, ativo FROM barbeiros WHERE usuario_id = ? LIMIT 1',
    [userId],
  );
  return row ?? null;
}

export async function findSettings(connection = pool) {
  const [[row]] = await connection.execute(
    `SELECT fuso_horario, tempo_minimo_cancelamento_horas
     FROM configuracoes WHERE id=1`,
  );
  return row ?? null;
}

export async function dashboardSummary({ barberId = null, startAt, endAt }, connection = pool) {
  const barberClause = barberId == null ? '' : 'AND a.barbeiro_id = ?';
  const parameters = barberId == null ? [startAt, endAt] : [startAt, endAt, barberId];
  const [[totals]] = await connection.execute(
    `SELECT COUNT(*) total,
      SUM(a.status='pendente') pendentes,
      SUM(a.status='confirmado') confirmados,
      SUM(a.status='em_atendimento') em_atendimento,
      SUM(a.status='concluido') concluidos,
      SUM(a.status='cancelado') cancelados,
      SUM(a.status='ausente') ausentes
     FROM agendamentos a
     WHERE a.inicio_em >= ? AND a.inicio_em < ? ${barberClause}`,
    parameters,
  );
  const nextParameters = barberId == null ? [startAt, endAt] : [startAt, endAt, barberId];
  const [[next]] = await connection.execute(
    `${detailSelect}
     WHERE a.inicio_em >= ? AND a.inicio_em < ? ${barberClause}
       AND a.status IN ('pendente','confirmado','em_atendimento')
     ORDER BY a.inicio_em ASC LIMIT 1`,
    nextParameters,
  );
  return { totals, next: next ?? null };
}

export async function dashboardByBarber({ startAt, endAt }, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT b.id barbeiro_id, u.nome,
            COUNT(a.id) total,
            SUM(a.status='pendente') pendentes,
            SUM(a.status='confirmado') confirmados,
            SUM(a.status='em_atendimento') em_atendimento,
            SUM(a.status='concluido') concluidos,
            SUM(a.status='cancelado') cancelados,
            SUM(a.status='ausente') ausentes
     FROM barbeiros b
     JOIN usuarios u ON u.id=b.usuario_id
     LEFT JOIN agendamentos a ON a.barbeiro_id=b.id AND a.inicio_em>=? AND a.inicio_em<?
     WHERE b.ativo=TRUE AND u.ativo=TRUE
     GROUP BY b.id,u.nome ORDER BY u.nome`,
    [startAt, endAt],
  );
  return rows;
}
