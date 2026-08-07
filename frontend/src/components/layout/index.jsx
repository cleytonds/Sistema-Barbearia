import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { BrandMark } from '../brand/BrandMark.jsx';
import { Button } from '../ui/index.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useRemoteData } from '../../hooks/useRemoteData.js';
import { operacionalService } from '../../services/operacionalService.js';
import { servicoService } from '../../services/servicoService.js';
import { ClockIcon, InstagramIcon, LocationIcon, MenuIcon, PhoneIcon } from '../ui/Icons.jsx';

export function Container({ as: Element = 'div', children, className = '' }) {
  return createElement(Element, { className: `container ${className}`.trim() }, children);
}

function formatPhone(phone) {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  if (digits.length === 11)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return phone;
}
export function SkipLink() {
  return (
    <a className="skip-link" href="#conteudo">
      Pular para o conteúdo
    </a>
  );
}

const publicLinks = [
  ['/', 'Início'],
  ['/#servicos', 'Serviços'],
  ['/#profissionais', 'Barbeiros'],
  ['/planos', 'Planos'],
];
function Navigation({ isClient = false, onNavigate }) {
  const links = isClient
    ? [...publicLinks, ['/meus-agendamentos', 'Meus agendamentos'], ['/meu-plano', 'Meu plano']]
    : publicLinks;
  return (
    <nav aria-label="Navegação principal" className="cluster">
      {links.map(([to, label]) => (
        <NavLink onClick={onNavigate} key={to} to={to}>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
export function MobileMenu({ isAuthenticated, isClient, onClose, onLogout, open }) {
  return open ? (
    <div className="mobile-menu" id="mobile-navigation" role="dialog" aria-label="Menu principal">
      <Navigation isClient={isClient} onNavigate={onClose} />
      <div className="mobile-menu__account">
        {isAuthenticated ? (
          <>
            <Link to={isClient ? '/meus-agendamentos' : '/'} onClick={onClose}>
              Conta
            </Link>
            <button type="button" onClick={onLogout}>
              Sair
            </button>
          </>
        ) : (
          <Link to="/login" onClick={onClose}>
            Entrar
          </Link>
        )}
      </div>
    </div>
  ) : null;
}
export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTriggerRef = useRef(null);
  const { isAuthenticated, usuario, logout } = useAuth();
  const isClient = usuario?.perfil === 'cliente';
  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuTriggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);
  const closeMenu = () => setMenuOpen(false);
  const logoutFromMenu = () => {
    closeMenu();
    logout();
  };
  return (
    <header className="site-header">
      <Container className="header-inner">
        <button
          ref={menuTriggerRef}
          className="mobile-trigger"
          type="button"
          aria-label="Abrir menu"
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <MenuIcon />
        </button>
        <div className="header-brand">
          <BrandMark />
        </div>
        <div className="desktop-nav">
          <Navigation isClient={isClient} />
        </div>
        <div className="header-actions">
          {isAuthenticated ? (
            <>
              <Link to={isClient ? '/meus-agendamentos' : '/'}>Conta</Link>
              <Button variant="secondary" onClick={logout}>
                Sair
              </Button>
            </>
          ) : (
            <Link className="header-account-link" to="/login">
              Entrar
            </Link>
          )}
          <Link className="button button--primary header-cta" to="/agendar">
            Agendar
          </Link>
        </div>
      </Container>
      <Container>
        <MobileMenu
          isAuthenticated={isAuthenticated}
          isClient={isClient}
          open={menuOpen}
          onClose={closeMenu}
          onLogout={logoutFromMenu}
        />
      </Container>
    </header>
  );
}
export function Footer() {
  const loader = useCallback(async () => {
    const [configuration, hours, services] = await Promise.all([
      operacionalService.publicConfig(),
      operacionalService.publicHours(),
      servicoService.listPublic({ page: 1, limit: 5, sort: 'nome', order: 'asc' }),
    ]);
    return { configuration: configuration.data, hours: hours.data, services: services.data };
  }, []);
  const { data } = useRemoteData(loader, [loader]);
  const configuration = data?.configuration;
  const hours = data?.hours ?? [];
  const services = data?.services ?? [];
  const activeHours = hours.filter((day) => day.ativo);
  const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const instagramUrl = 'https://www.instagram.com/barbeariaelite081/';
  return (
    <footer className="site-footer">
      <Container className="footer-grid">
        <section className="footer-section" aria-labelledby="footer-brand-title">
          <BrandMark linked={false} variant="footer" loading="lazy" />
          <h2 id="footer-brand-title">Elite Barbearia 081</h2>
          <p className="muted">
            Elite Barbearia 081 é mais que um corte. É estilo, confiança e atitude.
          </p>
          <a
            className="footer-contact-line"
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram da Elite Barbearia 081"
          >
            <InstagramIcon /> <span>@barbeariaelite081</span>
          </a>
        </section>
        {services.length > 0 && (
          <nav className="footer-section" aria-labelledby="footer-services-title">
            <h2 id="footer-services-title">Serviços</h2>
            {services.slice(0, 5).map((service) => (
              <Link key={service.id} to={`/agendar?servicoId=${service.id}`}>
                {service.nome}
              </Link>
            ))}
            <Link className="footer-more-link" to="/#servicos">
              Ver todos os serviços
            </Link>
          </nav>
        )}
        <nav className="footer-section" aria-labelledby="footer-links-title">
          <h2 id="footer-links-title">Links rápidos</h2>
          <Link to="/">Início</Link>
          <Link to="/#servicos">Serviços</Link>
          <Link to="/#profissionais">Barbeiros</Link>
          <Link to="/planos">Planos</Link>
          <Link to="/agendar">Agendar horário</Link>
          <Link to="/meus-agendamentos">Meus agendamentos</Link>
          <Link to="/meu-plano">Meu plano</Link>
        </nav>
        <section className="footer-section" aria-labelledby="footer-contact-title">
          <h2 id="footer-contact-title">Contato</h2>
          {configuration?.telefone && (
            <a className="footer-contact-line" href={`tel:${configuration.telefone}`}>
              <PhoneIcon />
              <span>{formatPhone(configuration.telefone)}</span>
            </a>
          )}
          {configuration?.endereco && (
            <p className="footer-contact-line">
              <LocationIcon />
              <span>{configuration.endereco}</span>
            </p>
          )}
          {activeHours.length > 0 && (
            <div className="footer-contact-line footer-hours">
              <ClockIcon />
              <ul>
                {activeHours.map((day) => (
                  <li key={day.dia_semana}>
                    {dayNames[day.dia_semana]}: {day.hora_inicio}–{day.hora_fim}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <a
            className="footer-contact-line"
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Abrir Instagram da Elite Barbearia 081 em nova aba"
          >
            <InstagramIcon /> <span>@barbeariaelite081</span>
          </a>
        </section>
      </Container>
      <Container className="footer-bottom">
        <small>
          © {new Date().getFullYear()} Elite Barbearia 081. Todos os direitos reservados.
        </small>
      </Container>
    </footer>
  );
}
export function PublicLayout() {
  return (
    <div className="app-shell">
      <SkipLink />
      <Header />
      <main id="conteudo">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
export function ClientLayout() {
  return <PublicLayout />;
}
