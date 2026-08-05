import { pool } from '../config/database.js';
export async function list({ search, pagination }, db = pool) {
  const nameTerm = `%${search.trim()}%`;
  const emailTerm = `%${search.trim().toLowerCase()}%`;
  const phoneTerm = `%${search.replace(/\D/g, '')}%`;
  const params = [nameTerm, emailTerm, phoneTerm];
  const where = `EXISTS (SELECT 1 FROM usuario_papeis up INNER JOIN papeis p ON p.id=up.papel_id
    WHERE up.usuario_id=usuarios.id AND p.nome='cliente') AND (nome LIKE ? OR email LIKE ? OR telefone LIKE ?)`;
  const [[count]] = await db.execute(`SELECT COUNT(*) total FROM usuarios WHERE ${where}`, params);
  const [rows] = await db.execute(
    `SELECT id,nome,email,telefone,ativo FROM usuarios WHERE ${where} ORDER BY nome ASC LIMIT ${pagination.limit} OFFSET ${pagination.offset}`,
    params,
  );
  return { rows, total: Number(count.total) };
}
export async function find(id, db = pool) {
  const [[row]] = await db.execute(
    `SELECT u.id,u.nome,u.email,u.telefone,u.ativo FROM usuarios u
     WHERE u.id=? AND EXISTS (SELECT 1 FROM usuario_papeis up INNER JOIN papeis p ON p.id=up.papel_id
       WHERE up.usuario_id=u.id AND p.nome='cliente')`,
    [id],
  );
  return row ?? null;
}
export async function summary(id, db = pool) {
  const [[counts]] = await db.execute(
    `SELECT COUNT(*) total, SUM(status IN ('pendente','confirmado','em_atendimento') AND inicio_em>=UTC_TIMESTAMP(6)) proximos, SUM(status='concluido') concluidos, SUM(status='cancelado') cancelados, SUM(status='ausente') ausentes FROM agendamentos WHERE cliente_id=?`,
    [id],
  );
  const [services] = await db.execute(
    'SELECT DISTINCT s.id,s.nome FROM agendamentos a JOIN servicos s ON s.id=a.servico_id WHERE a.cliente_id=? ORDER BY s.nome',
    [id],
  );
  const [barbers] = await db.execute(
    'SELECT DISTINCT b.id,u.nome FROM agendamentos a JOIN barbeiros b ON b.id=a.barbeiro_id JOIN usuarios u ON u.id=b.usuario_id WHERE a.cliente_id=? ORDER BY u.nome',
    [id],
  );
  return { counts, services, barbers };
}
