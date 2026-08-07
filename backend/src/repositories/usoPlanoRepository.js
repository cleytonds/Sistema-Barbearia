import { pool } from '../config/database.js';

const usoCols = `id, assinatura_id, agendamento_id, status, data_utilizacao,
  semana_inicio, reservado_em, consumido_em, liberado_em, motivo_liberacao,
  criado_em, atualizado_em`;

export async function buscarUsoPorAgendamento(agendamentoId, connection = pool) {
  const [[row]] = await connection.execute(
    `SELECT ${usoCols} FROM usos_planos WHERE agendamento_id = ? LIMIT 1`,
    [agendamentoId],
  );
  return row ?? null;
}

export async function buscarUsoPorAgendamentoForUpdate(agendamentoId, connection) {
  const [[row]] = await connection.execute(
    `SELECT ${usoCols} FROM usos_planos WHERE agendamento_id = ? LIMIT 1 FOR UPDATE`,
    [agendamentoId],
  );
  return row ?? null;
}

export async function criarUsoReservado(data, connection) {
  const [result] = await connection.execute(
    `INSERT INTO usos_planos (assinatura_id, agendamento_id, data_utilizacao, semana_inicio)
     VALUES (?, ?, ?, ?)`,
    [data.subscriptionId, data.appointmentId, data.date, data.week],
  );
  return result.insertId;
}

export async function consumirUso(id, now, connection) {
  const [result] = await connection.execute(
    `UPDATE usos_planos SET status = 'consumido', consumido_em = ?, liberado_em = NULL,
       motivo_liberacao = NULL WHERE id = ? AND status = 'reservado'`,
    [now, id],
  );
  return result.affectedRows > 0;
}

export async function liberarUso(id, { now, motivo }, connection) {
  const [result] = await connection.execute(
    `UPDATE usos_planos SET status = 'liberado', liberado_em = ?, motivo_liberacao = ?,
       consumido_em = NULL WHERE id = ? AND status = 'reservado'`,
    [now, motivo ?? null, id],
  );
  return result.affectedRows > 0;
}

export async function atualizarPeriodoDoUso(id, { date, week }, connection) {
  await connection.execute(
    `UPDATE usos_planos SET data_utilizacao = ?, semana_inicio = ? WHERE id = ?`,
    [date, week, id],
  );
}

export async function contarUsosSemana(assinaturaId, semanaInicio, connection = pool) {
  const [[row]] = await connection.execute(
    `SELECT COUNT(*) AS total FROM usos_planos
     WHERE assinatura_id = ? AND semana_inicio = ?
       AND status IN ('reservado', 'consumido')`,
    [assinaturaId, semanaInicio],
  );
  return Number(row.total);
}

export async function contarUsosTotal(assinaturaId, connection = pool) {
  const [[row]] = await connection.execute(
    `SELECT COUNT(*) AS total FROM usos_planos
     WHERE assinatura_id = ? AND status IN ('reservado', 'consumido')`,
    [assinaturaId],
  );
  return Number(row.total);
}

export async function listarUsosDaAssinatura(assinaturaId, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT ${usoCols} FROM usos_planos
     WHERE assinatura_id = ? ORDER BY data_utilizacao DESC`,
    [assinaturaId],
  );
  return rows;
}

export async function listarUsosAtivos(assinaturaId, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT ${usoCols} FROM usos_planos
     WHERE assinatura_id = ? AND status IN ('reservado', 'consumido')
     ORDER BY data_utilizacao DESC`,
    [assinaturaId],
  );
  return rows;
}

export async function verificarUsoDuplicado(assinaturaId, agendamentoId, connection = pool) {
  const [[row]] = await connection.execute(
    `SELECT id FROM usos_planos WHERE agendamento_id = ? LIMIT 1`,
    [agendamentoId],
  );
  return row?.id ?? null;
}
