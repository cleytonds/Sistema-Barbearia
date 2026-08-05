export const homeByRole = (role) =>
  ({ cliente: '/meus-agendamentos', barbeiro: '/barbeiro', admin: '/admin' })[role] ??
  '/acesso-negado';

export function destinationByRoles(user, intended) {
  const roles = [...new Set(user?.papeis ?? [user?.perfil].filter(Boolean))];
  if (roles.includes('cliente') && intended) return intended;
  if (roles.includes('barbeiro') && roles.includes('admin')) return '/selecionar-area';
  if (roles.includes('barbeiro')) return '/barbeiro';
  if (roles.includes('admin')) return '/admin';
  if (roles.includes('cliente')) return '/meus-agendamentos';
  return '/acesso-negado';
}

export function safeInternalPath(value) {
  return typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !/^[a-z]+:/i.test(value)
    ? value
    : null;
}
