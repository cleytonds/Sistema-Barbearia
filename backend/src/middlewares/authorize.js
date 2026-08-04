import { AppError } from '../utils/AppError.js';

/**
 * Restringe a rota aos perfis informados pelo backend.
 * O perfil nunca é aceito do frontend; ele vem do usuário recarregado pelo middleware de autenticação.
 */
export const requireRoles =
  (...roles) =>
  (req, _res, next) => {
    if (!req.auth) return next(new AppError('Autenticação necessária.', 401, 'AUTH_REQUIRED'));
    if (!roles.includes(req.auth.usuario.perfil))
      return next(new AppError('Acesso não autorizado.', 403, 'FORBIDDEN'));
    next();
  };

export const requireAdmin = () => requireRoles('admin');
export const requireBarbeiro = () => requireRoles('barbeiro');
export const requireCliente = () => requireRoles('cliente');
