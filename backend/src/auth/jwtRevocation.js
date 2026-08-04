import { createHash } from 'node:crypto';
import { pool } from '../config/database.js';

export function hashJti(jti) {
  return createHash('sha256').update(jti).digest('hex');
}

export async function isTokenRevoked(jti, connection = pool) {
  const [[row]] = await connection.execute(
    'SELECT id FROM tokens_jwt_revogados WHERE jti_hash = ? AND expira_em > UTC_TIMESTAMP(6) LIMIT 1',
    [hashJti(jti)]
  );
  return Boolean(row);
}

export async function revokeToken({ userId, jti, expiresAt }, connection = pool) {
  await connection.execute(
    `INSERT INTO tokens_jwt_revogados (usuario_id, jti_hash, expira_em)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE jti_hash = VALUES(jti_hash)`,
    [userId, hashJti(jti), expiresAt]
  );
}

export async function cleanupExpiredRevocations(connection = pool) {
  const [result] = await connection.execute('DELETE FROM tokens_jwt_revogados WHERE expira_em <= UTC_TIMESTAMP(6)');
  return result.affectedRows;
}

