import { pool } from '../config/database.js';

export async function buscarPorAgendamentoForUpdate(agendamentoId, connection) {
  const [[row]] = await connection.execute(
    'SELECT * FROM comissoes WHERE agendamento_id = ? LIMIT 1 FOR UPDATE',
    [agendamentoId],
  );
  return row ?? null;
}

export async function buscarConfiguracaoAtiva(barbeiroId, connection = pool) {
  const [[row]] = await connection.execute(
    `SELECT barbeiro_id, CAST(percentual_avulso AS CHAR) percentual_avulso,
            CAST(percentual_plano AS CHAR) percentual_plano
     FROM configuracoes_comissao_barbeiros
     WHERE barbeiro_id = ? AND ativo = TRUE LIMIT 1`,
    [barbeiroId],
  );
  return row ?? null;
}

export async function buscarBarbeiroAtivo(barbeiroId, connection = pool) {
  const [[row]] = await connection.execute(
    'SELECT id FROM barbeiros WHERE id = ? AND ativo = TRUE LIMIT 1',
    [barbeiroId],
  );
  return row ?? null;
}

export async function salvarConfiguracao(data, connection) {
  await connection.execute(
    `INSERT INTO configuracoes_comissao_barbeiros
       (barbeiro_id, percentual_avulso, percentual_plano, ativo)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE percentual_avulso=VALUES(percentual_avulso),
       percentual_plano=VALUES(percentual_plano), ativo=VALUES(ativo)`,
    [data.barbeiroId, data.percentualAvulso, data.percentualPlano, data.ativo],
  );
}

export async function buscarConfiguracao(barbeiroId, connection = pool) {
  const [[row]] = await connection.execute(
    `SELECT barbeiro_id, CAST(percentual_avulso AS CHAR) percentual_avulso,
            CAST(percentual_plano AS CHAR) percentual_plano, ativo, criado_em, atualizado_em
     FROM configuracoes_comissao_barbeiros WHERE barbeiro_id = ? LIMIT 1`,
    [barbeiroId],
  );
  return row ?? null;
}

export async function buscarValorBasePlano(planoId, servicoId, connection = pool) {
  const [[row]] = await connection.execute(
    `SELECT CAST(valor_base_comissao AS CHAR) valor_base_comissao
     FROM plano_servicos WHERE plano_id = ? AND servico_id = ? LIMIT 1`,
    [planoId, servicoId],
  );
  return row?.valor_base_comissao ?? null;
}

export async function buscarServicoPlanoForUpdate(planoId, servicoId, connection) {
  const [[row]] = await connection.execute(
    `SELECT plano_id, servico_id, CAST(valor_base_comissao AS CHAR) valor_base_comissao
     FROM plano_servicos WHERE plano_id = ? AND servico_id = ? LIMIT 1 FOR UPDATE`,
    [planoId, servicoId],
  );
  return row ?? null;
}

export async function atualizarValorBasePlano(planoId, servicoId, valorBase, connection) {
  await connection.execute(
    'UPDATE plano_servicos SET valor_base_comissao = ? WHERE plano_id = ? AND servico_id = ?',
    [valorBase, planoId, servicoId],
  );
}

export async function criar(data, connection) {
  const [result] = await connection.execute(
    `INSERT INTO comissoes (
       agendamento_id, barbeiro_id, tipo_cobranca, valor_base_snapshot,
       percentual_snapshot, valor_comissao
     ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.agendamentoId,
      data.barbeiroId,
      data.tipoCobranca,
      data.valorBase,
      data.percentual,
      data.valorComissao,
    ],
  );
  return result.insertId;
}

const commissionColumns = `c.id, c.agendamento_id, c.barbeiro_id, u.nome barbeiro_nome,
  c.tipo_cobranca, CAST(c.valor_base_snapshot AS CHAR) valor_base_snapshot,
  CAST(c.percentual_snapshot AS CHAR) percentual_snapshot,
  CAST(c.valor_comissao AS CHAR) valor_comissao, c.status, c.pago_por,
  pagador.nome pago_por_nome, c.pago_em, c.criado_em, c.atualizado_em,
  a.servico_id, s.nome servico_nome`;

export async function listar(filters, pagination, connection = pool) {
  const conditions = [];
  const parameters = [];
  const add = (sql, value) => {
    if (value != null && value !== '') {
      conditions.push(sql);
      parameters.push(value);
    }
  };
  add('c.barbeiro_id = ?', filters.barbeiroId);
  add('c.tipo_cobranca = ?', filters.tipo);
  add('c.status = ?', filters.status);
  add('c.criado_em >= ?', filters.inicio);
  if (filters.fim) {
    conditions.push('c.criado_em < DATE_ADD(?, INTERVAL 1 DAY)');
    parameters.push(filters.fim);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const joins = `FROM comissoes c
    JOIN agendamentos a ON a.id=c.agendamento_id
    JOIN barbeiros b ON b.id=c.barbeiro_id
    JOIN usuarios u ON u.id=b.usuario_id
    JOIN servicos s ON s.id=a.servico_id
    LEFT JOIN usuarios pagador ON pagador.id=c.pago_por`;
  const [[count]] = await connection.execute(`SELECT COUNT(*) total ${joins} ${where}`, parameters);
  const [rows] = await connection.execute(
    `SELECT ${commissionColumns} ${joins} ${where}
     ORDER BY ${pagination.sortColumn} ${pagination.order}
     LIMIT ${pagination.limit} OFFSET ${pagination.offset}`,
    parameters,
  );
  return { rows, total: Number(count.total) };
}

export async function buscarPorIdForUpdate(id, connection) {
  const [[row]] = await connection.execute(
    'SELECT * FROM comissoes WHERE id = ? LIMIT 1 FOR UPDATE',
    [id],
  );
  return row ?? null;
}

export async function buscarPorId(id, connection = pool) {
  const [[row]] = await connection.execute(
    `SELECT ${commissionColumns}
     FROM comissoes c
     JOIN agendamentos a ON a.id=c.agendamento_id
     JOIN barbeiros b ON b.id=c.barbeiro_id
     JOIN usuarios u ON u.id=b.usuario_id
     JOIN servicos s ON s.id=a.servico_id
     LEFT JOIN usuarios pagador ON pagador.id=c.pago_por
     WHERE c.id = ? LIMIT 1`,
    [id],
  );
  return row ?? null;
}

export async function marcarComoPaga(id, { actorId, now }, connection) {
  await connection.execute(
    `UPDATE comissoes SET status='paga', pago_por=?, pago_em=?
     WHERE id=? AND status='pendente'`,
    [actorId, now, id],
  );
}
