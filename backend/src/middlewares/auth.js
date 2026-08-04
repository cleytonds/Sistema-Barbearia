import { verifyAccessToken } from '../auth/jwtVerifier.js';
import { isTokenRevoked } from '../auth/jwtRevocation.js';
import { findUserById } from '../repositories/userRepository.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Autentica a requisição e carrega o estado atual do usuário.
 *
 * Mesmo após validar o JWT, consulta o banco para impedir acesso de usuários
 * desativados, sessões cuja versão foi invalidada e tokens revogados por logout.
 */
export const auth = () =>
  asyncHandler(async (req, _res, next) => {
    const authorization = req.get('authorization');
    if (!authorization?.startsWith('Bearer ') || authorization.split(' ').length !== 2) {
      throw new AppError('Autenticação necessária.', 401, 'AUTH_REQUIRED');
    }
    const token = authorization.slice(7);
    if (token.length > 4096) throw new AppError('Token inválido.', 401, 'INVALID_TOKEN');
    const payload = verifyAccessToken(token);
    const [user, revoked] = await Promise.all([
      findUserById(payload.sub),
      isTokenRevoked(payload.jti),
    ]);
    if (!user || !user.ativo || user.auth_versao !== payload.ver || revoked) {
      throw new AppError('Sessão inválida ou revogada.', 401, 'SESSION_REVOKED');
    }
    req.auth = {
      token: { jti: payload.jti, exp: payload.exp, versao: payload.ver },
      usuario: { id: user.id, nome: user.nome, perfil: user.perfil },
    };
    next();
  });
