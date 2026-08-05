import { AppError } from '../utils/AppError.js';

/**
 * Restringe a rota aos perfis informados pelo backend.
 * O perfil nunca é aceito do frontend; ele vem do usuário recarregado pelo middleware de autenticação.
 */
export const requireAnyRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.auth) return next(new AppError('Autenticação necessária.', 401, 'AUTH_REQUIRED'));
    if (!roles.some((role) => req.auth.usuario.papeis.includes(role)))
      return next(new AppError('Acesso não autorizado.', 403, 'FORBIDDEN'));
    next();
  };

export const requireRole = (role) => requireAnyRole(role);
export const requireRoles = requireAnyRole;
export const requireAdmin = () => requireRole('admin');
export const requireBarbeiro = () => requireRole('barbeiro');
export const requireCliente = () => requireRole('cliente');
