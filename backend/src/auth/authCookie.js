import { env } from '../config/env.js';

export const AUTH_COOKIE_NAME = 'barbearia_session';

export function authCookieOptions({
  production = env.nodeEnv === 'production',
  maxAgeSeconds,
} = {}) {
  return {
    httpOnly: true,
    secure: production,
    sameSite: 'lax',
    path: '/',
    ...(Number.isFinite(maxAgeSeconds) && maxAgeSeconds > 0
      ? { maxAge: Math.floor(maxAgeSeconds * 1000) }
      : {}),
  };
}

export function setAuthCookie(response, { accessToken, expiresIn }) {
  response.cookie(AUTH_COOKIE_NAME, accessToken, authCookieOptions({ maxAgeSeconds: expiresIn }));
}

export function clearAuthCookie(response) {
  response.clearCookie(AUTH_COOKIE_NAME, authCookieOptions());
}

export function readAuthCookie(request) {
  const header = request.get('cookie');
  if (!header) return { present: false, value: null };
  for (const item of header.split(';')) {
    const separator = item.indexOf('=');
    const name = (separator < 0 ? item : item.slice(0, separator)).trim();
    if (name !== AUTH_COOKIE_NAME) continue;
    const encodedValue = separator < 0 ? '' : item.slice(separator + 1).trim();
    try {
      return { present: true, value: decodeURIComponent(encodedValue) };
    } catch {
      return { present: true, value: encodedValue };
    }
  }
  return { present: false, value: null };
}
