import * as authService from '../services/authService.js';
import { clearAuthCookie, setAuthCookie } from '../auth/authCookie.js';

function respondWithSession(response, status, session) {
  setAuthCookie(response, session);
  const { usuario, expiresIn } = session;
  response.status(status).json({ usuario, expiresIn });
}

export async function register(req, res) {
  respondWithSession(res, 201, await authService.register(req.body));
}

export async function login(req, res) {
  respondWithSession(res, 200, await authService.login(req.body));
}

export async function me(req, res) {
  res.json({ usuario: await authService.getMe(req.auth.usuario.id) });
}

export async function logout(req, res) {
  try {
    await authService.logout(req.auth);
  } finally {
    clearAuthCookie(res);
  }
  res.status(204).end();
}

export async function forgotPassword(req, res) {
  await authService.requestPasswordRecovery(req.body.email);
  res.json({ message: 'Se o e-mail estiver cadastrado, enviaremos as instruções.' });
}

export async function resetPassword(req, res) {
  await authService.resetPassword(req.body);
  res.json({ message: 'Senha redefinida com sucesso.' });
}

export async function changePassword(req, res) {
  respondWithSession(res, 200, await authService.changePassword(req.auth.usuario.id, req.body));
}
