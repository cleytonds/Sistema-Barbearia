import { createHash } from 'node:crypto';
import { pool } from '../config/database.js';

/** Gera uma representação irreversível do JTI para não armazenar o identificador em claro. */
export function hashJti(jti) {
  return createHash('sha256').update(jti).digest('hex');
}

/** Informa se o token permanece revogado no instante atual. */
export async function isTokenRevoked(jti, connection = pool) {
  const [[row]] = await connection.execute(
    'SELECT id FROM tokens_jwt_revogados WHERE jti_hash = ? AND expira_em > UTC_TIMESTAMP(6) LIMIT 1',
    [hashJti(jti)],
  );
  return Boolean(row);
}

/** Registra a revogação de forma idempotente até a expiração natural do JWT. */
export async function revokeToken({ userId, jti, expiresAt }, connection = pool) {
  await connection.execute(
    `INSERT INTO tokens_jwt_revogados (usuario_id, jti_hash, expira_em)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE jti_hash = VALUES(jti_hash)`,
    [userId, hashJti(jti), expiresAt],
  );
}

/** Remove revogações expiradas para limitar o crescimento da tabela operacional. */
export async function cleanupExpiredRevocations(connection = pool) {
  const [result] = await connection.execute(
    'DELETE FROM tokens_jwt_revogados WHERE expira_em <= UTC_TIMESTAMP(6)',
  );
  return result.affectedRows;
}
