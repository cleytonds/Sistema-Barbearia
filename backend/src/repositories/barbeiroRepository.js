import { pool } from '../config/database.js';
const cols = `b.id,b.usuario_id,u.nome,u.email,u.telefone,u.ativo usuario_ativo,b.descricao,b.foto_url,b.especialidades,b.ativo,b.criado_em,b.atualizado_em`;
export async function findBarber(id, db = pool) {
  const [[r]] = await db.execute(
    `SELECT ${cols} FROM barbeiros b JOIN usuarios u ON u.id=b.usuario_id WHERE b.id=?`,
    [id],
  );
  return r ?? null;
}
export async function findBarberByUser(id, db = pool) {
  const [[r]] = await db.execute(
    `SELECT ${cols} FROM barbeiros b JOIN usuarios u ON u.id=b.usuario_id WHERE b.usuario_id=?`,
    [id],
  );
  return r ?? null;
}
export async function listBarbers(
  { publicOnly, search, ativo, serviceId = null, pagination },
  db = pool,
) {
  const c = [],
    p = [];
  if (publicOnly) c.push('b.ativo=TRUE AND u.ativo=TRUE');
  else if (ativo !== undefined && ativo !== 'all') {
    c.push('b.ativo=?');
    p.push(ativo === 'true');
  }
  if (search) {
    c.push('u.nome LIKE ?');
    p.push(`%${search}%`);
  }
  if (serviceId) {
    c.push(
      'EXISTS (SELECT 1 FROM barbeiro_servicos bs WHERE bs.barbeiro_id=b.id AND bs.servico_id=?)',
    );
    p.push(serviceId);
  }
  const w = c.length ? `WHERE ${c.join(' AND ')}` : '';
  const [[n]] = await db.execute(
    `SELECT COUNT(*) total FROM barbeiros b JOIN usuarios u ON u.id=b.usuario_id ${w}`,
    p,
  );
  const [r] = await db.execute(
    `SELECT ${cols} FROM barbeiros b JOIN usuarios u ON u.id=b.usuario_id ${w} ORDER BY ${pagination.sortColumn} ${pagination.order} LIMIT ${pagination.limit} OFFSET ${pagination.offset}`,
    p,
  );
  return { rows: r, total: n.total };
}
export async function getServices(id, publicOnly = false, db = pool) {
  const [r] = await db.execute(
    `SELECT s.id,s.nome,s.descricao,s.preco,s.duracao_minutos,s.ativo FROM barbeiro_servicos bs JOIN servicos s ON s.id=bs.servico_id WHERE bs.barbeiro_id=? ${publicOnly ? 'AND s.ativo=TRUE' : ''} ORDER BY s.nome`,
    [id],
  );
  return r;
}
