import { pool } from '../config/database.js';

const historicoCols = `id, plano_id, assinatura_id, pagamento_id, uso_id, tipo_evento,
  alterado_por, observacao, dados_anteriores, dados_novos, criado_em`;

export async function registrarEvento(data, connection = pool) {
  const [result] = await connection.execute(
    `INSERT INTO historico_planos (
       plano_id, assinatura_id, pagamento_id, uso_id, tipo_evento,
       alterado_por, observacao, dados_anteriores, dados_novos
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.planId ?? null,
      data.subscriptionId ?? null,
      data.paymentId ?? null,
      data.usageId ?? null,
      data.type,
      data.actorId,
      data.note ?? null,
      data.before == null ? null : JSON.stringify(data.before),
      data.after == null ? null : JSON.stringify(data.after),
    ],
  );
  return result.insertId;
}

export async function listarHistoricoDaAssinatura(assinaturaId, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT ${historicoCols} FROM historico_planos
     WHERE assinatura_id = ? ORDER BY criado_em DESC, id DESC`,
    [assinaturaId],
  );
  return rows;
}

export async function listarHistoricoDoPlano(planoId, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT ${historicoCols} FROM historico_planos
     WHERE plano_id = ? ORDER BY criado_em DESC, id DESC`,
    [planoId],
  );
  return rows;
}

export async function listarHistoricoDoUso(usoId, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT ${historicoCols} FROM historico_planos
     WHERE uso_id = ? ORDER BY criado_em DESC, id DESC`,
    [usoId],
  );
  return rows;
}
