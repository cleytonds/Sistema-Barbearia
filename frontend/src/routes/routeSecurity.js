export const homeByRole = (role) =>
  ({ cliente: '/meus-agendamentos', barbeiro: '/barbeiro', admin: '/admin' })[role] ??
  '/acesso-negado';

export function safeInternalPath(value) {
  return typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !/^[a-z]+:/i.test(value)
    ? value
    : null;
}
