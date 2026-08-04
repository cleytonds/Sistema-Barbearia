import { pool } from '../config/database.js';
import * as op from '../repositories/operacionalRepository.js';
import * as barbers from '../repositories/barbeiroRepository.js';
import { localToUtc } from '../utils/dateTime.js';
import { AppError } from '../utils/AppError.js';

export const listAdmin = () => op.blocks({ all: true });
export async function listMine(userId) { const b = await barbers.findBarberByUser(userId); if (!b) throw new AppError('Barbeiro não encontrado.', 404, 'BARBER_NOT_FOUND'); return op.blocks({ barberId: b.id }); }
async function create({ barberId, inicioLocal, fimLocal, motivo, allowPast = false, userId, global = false }) {
  const cfg = await op.config(); const start = localToUtc(inicioLocal, cfg.fuso_horario); const end = localToUtc(fimLocal, cfg.fuso_horario);
  if (end <= start) throw new AppError('Período inválido.', 422, 'VALIDATION_ERROR');
  if (start < new Date() && !allowPast) throw new AppError('Bloqueio no passado não permitido.', 422, 'BUSINESS_RULE_VIOLATION');
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    if (global) await c.query('SELECT id FROM barbeiros WHERE ativo=TRUE ORDER BY id FOR UPDATE');
    else { const [[b]] = await c.execute('SELECT id FROM barbeiros WHERE id=? AND ativo=TRUE FOR UPDATE', [barberId]); if (!b) throw new AppError('Barbeiro não encontrado.', 404, 'BARBER_NOT_FOUND'); }
    const params = global ? [end, start] : [barberId, end, start];
    const [conflicts] = await c.execute(`SELECT id,inicio_em,fim_em FROM agendamentos WHERE ${global ? '' : 'barbeiro_id=? AND '}status IN ('pendente','confirmado','em_atendimento') AND inicio_em < ? AND fim_em > ?`, params);
    if (conflicts.length) throw new AppError('Existem agendamentos conflitantes.', 409, 'SCHEDULE_CONFLICT', conflicts);
    const [r] = await c.execute('INSERT INTO bloqueios_agenda(barbeiro_id,inicio_em,fim_em,motivo,criado_por)VALUES(?,?,?,?,?)', [global ? null : barberId, start, end, motivo.trim(), userId]);
    await c.commit(); return { id: String(r.insertId), barbeiro_id: global ? null : String(barberId), inicio_em: start, fim_em: end, motivo };
  } catch (e) { await c.rollback(); throw e; } finally { c.release(); }
}
export async function createAdmin(data, userId) { return data.barbeiroId == null ? create({ global: true, ...data, userId, allowPast: Boolean(data.justificativaPassado) }) : create({ ...data, barberId: data.barbeiroId, userId, allowPast: Boolean(data.justificativaPassado) }); }
export async function createMine(data, userId) { const b = await barbers.findBarberByUser(userId); if (!b || !b.ativo) throw new AppError('Barbeiro não encontrado.', 404, 'BARBER_NOT_FOUND'); return create({ ...data, barberId: b.id, userId }); }
export async function remove(id, userId, isAdmin) { const [[block]] = await pool.execute('SELECT * FROM bloqueios_agenda WHERE id=?', [id]); if (!block) throw new AppError('Bloqueio não encontrado.', 404, 'BLOCK_NOT_FOUND'); if (!isAdmin) { const own = await barbers.findBarberByUser(userId); if (!own || block.barbeiro_id !== own.id || block.criado_por !== userId) throw new AppError('Acesso não autorizado.', 403, 'FORBIDDEN'); } await pool.execute('DELETE FROM bloqueios_agenda WHERE id=?', [id]); }
