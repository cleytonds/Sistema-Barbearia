import { pool } from '../config/database.js';

export const VALID_ROLES = Object.freeze(['cliente', 'barbeiro', 'admin']);

export async function listUserRoles(userId, db = pool) {
  const [rows] = await db.execute(
    `SELECT p.nome FROM usuario_papeis up
     INNER JOIN papeis p ON p.id = up.papel_id
     WHERE up.usuario_id = ? ORDER BY p.id`,
    [userId],
  );
  return rows.map((row) => row.nome);
}

export async function hasRole(userId, role, db = pool) {
  const [[row]] = await db.execute(
    `SELECT 1 AS found FROM usuario_papeis up
     INNER JOIN papeis p ON p.id = up.papel_id
     WHERE up.usuario_id = ? AND p.nome = ? LIMIT 1`,
    [userId, role],
  );
  return Boolean(row);
}

export async function grantRole(userId, role, db = pool) {
  if (!VALID_ROLES.includes(role)) throw new Error('Papel inválido.');
  const [result] = await db.execute(
    `INSERT IGNORE INTO usuario_papeis (usuario_id, papel_id)
     SELECT ?, id FROM papeis WHERE nome = ?`,
    [userId, role],
  );
  if (!result.affectedRows && !(await hasRole(userId, role, db))) {
    throw new Error('Papel não encontrado.');
  }
  return result.affectedRows > 0;
}

export async function removeRole(userId, role, db = pool) {
  if (!VALID_ROLES.includes(role)) throw new Error('Papel inválido.');
  const [result] = await db.execute(
    `DELETE up FROM usuario_papeis up INNER JOIN papeis p ON p.id = up.papel_id
     WHERE up.usuario_id = ? AND p.nome = ?`,
    [userId, role],
  );
  return result.affectedRows > 0;
}
