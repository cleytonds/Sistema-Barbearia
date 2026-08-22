import { pool } from '../config/database.js';
import { issueAccessToken } from '../auth/jwtIssuer.js';
import { comparePassword, compareWithDummyHash, hashPassword } from '../auth/password.js';
import { generateRecoveryToken, hashRecoveryToken } from '../auth/recoveryToken.js';
import { revokeToken } from '../auth/jwtRevocation.js';
import { AppError } from '../utils/AppError.js';
import { normalizeEmail, normalizeName, normalizePhone } from '../utils/normalize.js';
import {
  createClient,
  findUserByEmail,
  findUserById,
  findUserConflict,
  toPublicUser,
} from '../repositories/userRepository.js';
import { sendPasswordRecoveryEmail } from './emailService.js';
import { logger } from '../utils/logger.js';

const genericLoginError = () =>
  new AppError('E-mail ou senha inválidos.', 401, 'INVALID_CREDENTIALS');

function sessionFor(user) {
  const accessToken = issueAccessToken(user);
  const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8'));
  return { usuario: toPublicUser(user), accessToken, expiresIn: payload.exp - payload.iat };
}

export async function register(input) {
  const data = {
    name: normalizeName(input.nome),
    email: normalizeEmail(input.email),
    phone: normalizePhone(input.telefone),
  };
  if (await findUserConflict(data.email, data.phone)) {
    throw new AppError('E-mail ou telefone já cadastrado.', 409, 'USER_ALREADY_EXISTS');
  }
  data.passwordHash = await hashPassword(input.senha);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const user = await createClient(data, connection);
    await connection.commit();
    return sessionFor(user);
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY')
      throw new AppError('E-mail ou telefone já cadastrado.', 409, 'USER_ALREADY_EXISTS');
    throw error;
  } finally {
    connection.release();
  }
}

export async function login(input) {
  const user = await findUserByEmail(normalizeEmail(input.email));
  if (!user) {
    await compareWithDummyHash(input.senha);
    throw genericLoginError();
  }
  const valid = await comparePassword(input.senha, user.senha_hash);
  if (!valid || !user.ativo) throw genericLoginError();
  return sessionFor(user);
}

export async function getMe(userId) {
  const user = await findUserById(userId);
  if (!user || !user.ativo) throw new AppError('Sessão inválida.', 401, 'INVALID_TOKEN');
  return toPublicUser(user);
}

export async function logout(auth) {
  await revokeToken({
    userId: auth.usuario.id,
    jti: auth.token.jti,
    expiresAt: new Date(auth.token.exp * 1000),
  });
}

/**
 * Inicia recuperação sem revelar se a conta existe.
 * Tokens anteriores são invalidados na mesma transação e somente o hash do novo token é salvo.
 */
export async function requestPasswordRecovery(
  emailInput,
  { sendEmail = sendPasswordRecoveryEmail } = {},
) {
  const user = await findUserByEmail(normalizeEmail(emailInput));
  if (!user || !user.ativo) return;
  const { token, tokenHash } = generateRecoveryToken();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      'UPDATE tokens_recuperacao_senha SET utilizado_em = UTC_TIMESTAMP(6) WHERE usuario_id = ? AND utilizado_em IS NULL',
      [user.id],
    );
    await connection.execute(
      `INSERT INTO tokens_recuperacao_senha (usuario_id, token_hash, expira_em)
       VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 30 MINUTE))`,
      [user.id, tokenHash],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  try {
    await sendEmail({ email: user.email, token });
  } catch (error) {
    const errorCode =
      typeof error.code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(error.code)
        ? error.code
        : 'EMAIL_SEND_FAILED';
    logger.error('password_recovery_email_failed', {
      operation: 'password_recovery_email',
      errorCode,
    });
  }
}

/**
 * Consome o token de uso único sob lock e incrementa auth_versao.
 * O incremento invalida todos os JWT emitidos antes da redefinição da senha.
 */
export async function resetPassword({ token, novaSenha }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[record]] = await connection.execute(
      `SELECT id, usuario_id, expira_em, utilizado_em FROM tokens_recuperacao_senha
       WHERE token_hash = ? AND utilizado_em IS NULL AND expira_em > UTC_TIMESTAMP(6)
       LIMIT 1 FOR UPDATE`,
      [hashRecoveryToken(token)],
    );
    if (!record) {
      throw new AppError(
        'Token de recuperação inválido ou expirado.',
        400,
        'INVALID_RECOVERY_TOKEN',
      );
    }
    const user = await findUserById(record.usuario_id, connection, true);
    if (!user || !user.ativo)
      throw new AppError(
        'Token de recuperação inválido ou expirado.',
        400,
        'INVALID_RECOVERY_TOKEN',
      );
    if (await comparePassword(novaSenha, user.senha_hash))
      throw new AppError('A nova senha deve ser diferente da atual.', 422, 'PASSWORD_UNCHANGED');
    const passwordHash = await hashPassword(novaSenha);
    await connection.execute(
      'UPDATE usuarios SET senha_hash = ?, auth_versao = auth_versao + 1 WHERE id = ?',
      [passwordHash, user.id],
    );
    await connection.execute(
      'UPDATE tokens_recuperacao_senha SET utilizado_em = UTC_TIMESTAMP(6) WHERE usuario_id = ? AND utilizado_em IS NULL',
      [user.id],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/** Altera a senha após confirmar a atual e invalida sessões e recuperações anteriores. */
export async function changePassword(userId, { senhaAtual, novaSenha }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const user = await findUserById(userId, connection, true);
    if (!user || !user.ativo || !(await comparePassword(senhaAtual, user.senha_hash))) {
      throw new AppError('Senha atual incorreta.', 400, 'CURRENT_PASSWORD_INVALID');
    }
    if (await comparePassword(novaSenha, user.senha_hash))
      throw new AppError('A nova senha deve ser diferente da atual.', 422, 'PASSWORD_UNCHANGED');
    const passwordHash = await hashPassword(novaSenha);
    await connection.execute(
      'UPDATE usuarios SET senha_hash = ?, auth_versao = auth_versao + 1 WHERE id = ?',
      [passwordHash, user.id],
    );
    await connection.execute(
      'UPDATE tokens_recuperacao_senha SET utilizado_em = UTC_TIMESTAMP(6) WHERE usuario_id = ? AND utilizado_em IS NULL',
      [user.id],
    );
    const updated = await findUserById(user.id, connection);
    await connection.commit();
    return sessionFor(updated);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
