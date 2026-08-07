import { pool } from '../config/database.js';

const pagamentoCols = `id, assinatura_id, referencia_mes, periodo_inicio, periodo_fim,
  CAST(valor_confirmado AS CHAR) AS valor_confirmado, forma, status,
  confirmado_por, confirmado_em, cancelado_por, cancelado_em, observacao,
  criado_em, atualizado_em`;

export async function buscarPagamentoPorId(id, connection = pool) {
  const [[row]] = await connection.execute(
    `SELECT ${pagamentoCols} FROM pagamentos_planos WHERE id = ? LIMIT 1`,
    [id],
  );
  return row ?? null;
}

export async function buscarPorAssinaturaEReferencia(assinaturaId, referencia, connection = pool) {
  const [[row]] = await connection.execute(
    `SELECT ${pagamentoCols} FROM pagamentos_planos
     WHERE assinatura_id = ? AND referencia_mes = ? LIMIT 1`,
    [assinaturaId, referencia],
  );
  return row ?? null;
}

export async function buscarPorAssinaturaEReferenciaForUpdate(
  assinaturaId,
  referencia,
  connection,
) {
  const [[row]] = await connection.execute(
    `SELECT ${pagamentoCols} FROM pagamentos_planos
     WHERE assinatura_id = ? AND referencia_mes = ? LIMIT 1 FOR UPDATE`,
    [assinaturaId, referencia],
  );
  return row ?? null;
}

export async function criarPagamentoPendente(data, connection) {
  const [result] = await connection.execute(
    `INSERT INTO pagamentos_planos (
       assinatura_id, referencia_mes, periodo_inicio, periodo_fim,
       valor_confirmado, observacao
     ) VALUES (?, ?, ?, ?, ?, ?)`,
    [data.subscriptionId, data.reference, data.start, data.end, data.value, data.note ?? null],
  );
  return result.insertId;
}

export async function confirmarPagamento(id, { actorId, now }, connection) {
  const [result] = await connection.execute(
    `UPDATE pagamentos_planos SET status = 'confirmado', confirmado_por = ?, confirmado_em = ?
     WHERE id = ? AND status = 'pendente'`,
    [actorId, now, id],
  );
  return result.affectedRows > 0;
}

export async function cancelarPagamento(id, { actorId, now, motivo }, connection) {
  const [result] = await connection.execute(
    `UPDATE pagamentos_planos SET status = 'cancelado', cancelado_por = ?, cancelado_em = ?,
       observacao = ? WHERE id = ? AND status = 'pendente'`,
    [actorId, now, motivo ?? null, id],
  );
  return result.affectedRows > 0;
}

export async function listarPagamentosDaAssinatura(assinaturaId, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT ${pagamentoCols} FROM pagamentos_planos
     WHERE assinatura_id = ? ORDER BY referencia_mes DESC`,
    [assinaturaId],
  );
  return rows;
}

export async function verificarPagamentoConfirmadoParaData(assinaturaId, date, connection = pool) {
  const [[row]] = await connection.execute(
    `SELECT ${pagamentoCols} FROM pagamentos_planos
     WHERE assinatura_id = ? AND status = 'confirmado'
       AND periodo_inicio <= ? AND periodo_fim >= ? LIMIT 1`,
    [assinaturaId, date, date],
  );
  return row ?? null;
}
