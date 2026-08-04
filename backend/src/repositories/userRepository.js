import { pool } from '../config/database.js';

const publicColumns =
  'id, nome, email, telefone, perfil, ativo, auth_versao, criado_em, atualizado_em';

export async function findUserByEmail(email, connection = pool) {
  const [[row]] = await connection.execute(
    `SELECT ${publicColumns}, senha_hash FROM usuarios WHERE email = ? LIMIT 1`,
    [email],
  );
  return row ?? null;
}

export async function findUserById(id, connection = pool, forUpdate = false) {
  const [[row]] = await connection.execute(
    `SELECT ${publicColumns}, senha_hash FROM usuarios WHERE id = ? LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
    [id],
  );
  return row ?? null;
}

export async function findUserConflict(email, phone, connection = pool) {
  const [[row]] = await connection.execute(
    'SELECT id FROM usuarios WHERE email = ? OR telefone = ? LIMIT 1',
    [email, phone],
  );
  return row ?? null;
}

export async function createClient({ name, email, phone, passwordHash }, connection = pool) {
  const [result] = await connection.execute(
    `INSERT INTO usuarios (nome, email, telefone, senha_hash, perfil, ativo)
     VALUES (?, ?, ?, ?, 'cliente', TRUE)`,
    [name, email, phone, passwordHash],
  );
  return findUserById(result.insertId, connection);
}

export function toPublicUser(user) {
  return {
    id: String(user.id),
    nome: user.nome,
    email: user.email,
    telefone: user.telefone,
    perfil: user.perfil,
  };
}
