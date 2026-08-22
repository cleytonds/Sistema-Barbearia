import axios from 'axios';
import { authStorage } from '../utils/authStorage.js';

export function resolveApiBaseUrl(configuredUrl, location = globalThis.location) {
  const normalizedUrl = String(configuredUrl ?? '').trim();
  if (normalizedUrl) return normalizedUrl.replace(/\/$/, '');

  const protocol = location?.protocol === 'https:' ? 'https:' : 'http:';
  const hostname = location?.hostname || 'localhost';
  return `${protocol}//${hostname}:3000/api`;
}

export const api = axios.create({
  baseURL: resolveApiBaseUrl(import.meta.env?.VITE_API_URL),
  timeout: 10_000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  authStorage.clearLegacyToken();
  const method = String(config.method ?? 'get').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    config.headers.set('X-CSRF-Protection', '1');
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.endsWith('/auth/login')) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    return Promise.reject(error);
  },
);
