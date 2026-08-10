import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BrandMark } from '../brand/BrandMark.jsx';
import { useAuth } from '../../hooks/useAuth.js';

function Navigation({ links, close }) {
  return (
    <nav aria-label="Navegação operacional">
      <ul className="operational-nav">
        {links.map(({ to, label }) => (
          <li key={to}>
            <NavLink end={to.split('/').length === 2} to={to} onClick={close}>
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
export function OperationalLayout({ area, homePath, links }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef(null);
  const drawer = useRef(null);
  const { usuario, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const areaHomePath = homePath ?? links[0]?.to ?? '/';
  useEffect(() => {
    if (!open) return undefined;
    drawer.current?.querySelector('a')?.focus();
    const keyboard = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
      if (event.key !== 'Tab') return;
      const items = [...drawer.current.querySelectorAll('a,button:not(:disabled)')];
      if (!items.length) return;
      const first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => document.removeEventListener('keydown', keyboard);
  }, [open]);
  async function leave() {
    await logout();
    navigate('/login', { replace: true });
  }
  const sidebar = (
    <>
      <BrandMark variant="header" to={areaHomePath} />
      <p className="operational-role">{area}</p>
      <Navigation links={links} close={() => setOpen(false)} />
      {hasRole('barbeiro') && hasRole('admin') && (
        <Link
          className="button button--secondary"
          to={area === 'Administração' ? '/barbeiro' : '/admin'}
        >
          {area === 'Administração' ? 'Ir para minha agenda' : 'Ir para o painel administrativo'}
        </Link>
      )}
      <button className="button button--secondary" onClick={leave}>
        Sair
      </button>
    </>
  );
  return (
    <div className="operational-shell">
      <a className="skip-link" href="#conteudo-operacional">
        Pular para o conteúdo
      </a>
      <aside className="operational-sidebar">{sidebar}</aside>
      <header className="operational-header">
        <button
          ref={trigger}
          className="button button--secondary operational-menu-trigger"
          aria-expanded={open}
          aria-controls="operational-drawer"
          onClick={() => setOpen(true)}
        >
          Menu
        </button>
        <div>
          <strong>{usuario?.nome}</strong>
          <span>{area}</span>
        </div>
      </header>
      {open && (
        <div className="drawer-backdrop" onMouseDown={() => setOpen(false)}>
          <aside
            ref={drawer}
            id="operational-drawer"
            className="operational-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={`Menu ${area}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="button button--secondary"
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              Fechar
            </button>
            {sidebar}
          </aside>
        </div>
      )}
      <main id="conteudo-operacional" className="operational-main">
        <Outlet />
      </main>
    </div>
  );
}

export function PageHeader({ title, description, actions }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="cluster">{actions}</div>}
    </header>
  );
}
export function DashboardCard({ label, value }) {
  return (
    <article className="card dashboard-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
export function DataTable({ caption, columns, rows, renderActions }) {
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.label}
              </th>
            ))}
            {renderActions && <th scope="col">Ações</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>
              ))}
              {renderActions && <td>{renderActions(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
