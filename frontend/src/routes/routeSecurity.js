const VALID_ROLES = new Set(['cliente', 'barbeiro', 'admin']);
const GUEST_PATHS = new Set(['/login', '/cadastro', '/esqueci-senha', '/redefinir-senha']);
const CLIENT_EXACT_PATHS = new Set(['/', '/agendar', '/meus-agendamentos']);

export function normalizeRoles(user) {
  const roles = Array.isArray(user?.papeis) ? user.papeis : [user?.perfil];
  return [...new Set(roles.filter((role) => VALID_ROLES.has(role)))];
}

export const homeByRole = (role) =>
  ({ cliente: '/meus-agendamentos', barbeiro: '/barbeiro', admin: '/admin' })[role] ??
  '/acesso-negado';

export function safeInternalPath(value) {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\\r\n]/.test(value)
  )
    return null;
  try {
    const url = new URL(value, 'http://local.invalid');
    if (url.origin !== 'http://local.invalid') return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function pathnameOf(value) {
  const safePath = safeInternalPath(value);
  return safePath ? new URL(safePath, 'http://local.invalid').pathname : null;
}

export function defaultRouteForUser(user) {
  const roles = normalizeRoles(user);
  if (roles.includes('barbeiro') && roles.includes('admin')) return '/selecionar-area';
  if (roles.includes('barbeiro')) return '/barbeiro';
  if (roles.includes('admin')) return '/admin';
  if (roles.includes('cliente')) return '/meus-agendamentos';
  return '/acesso-negado';
}

export function isPathAuthorizedForUser(user, intended) {
  const pathname = pathnameOf(intended);
  if (!pathname || GUEST_PATHS.has(pathname)) return false;
  const roles = normalizeRoles(user);
  if (roles.includes('barbeiro') && roles.includes('admin')) return pathname === '/selecionar-area';
  if (roles.includes('barbeiro'))
    return pathname === '/barbeiro' || pathname.startsWith('/barbeiro/');
  if (roles.includes('admin')) return pathname === '/admin' || pathname.startsWith('/admin/');
  if (!roles.includes('cliente')) return false;
  return (
    CLIENT_EXACT_PATHS.has(pathname) ||
    pathname.startsWith('/agendamentos/') ||
    pathname.startsWith('/agendamento/sucesso/')
  );
}

export function resolvePostLoginDestination(user, intended) {
  const fallback = defaultRouteForUser(user);
  if (fallback === '/selecionar-area') return fallback;
  return isPathAuthorizedForUser(user, intended) ? safeInternalPath(intended) : fallback;
}

export function accessDeniedAction(user) {
  const destination = defaultRouteForUser(user);
  const labels = {
    '/meus-agendamentos': 'Voltar para meus agendamentos',
    '/barbeiro': 'Voltar para a área do barbeiro',
    '/admin': 'Voltar para o painel administrativo',
    '/selecionar-area': 'Escolher uma área',
  };
  return { destination, label: labels[destination] ?? 'Voltar ao início' };
}

export const destinationByRoles = resolvePostLoginDestination;
