import { createElement, useEffect, useId, useRef, useState } from 'react';

export function Button({ variant = 'primary', loading = false, children, disabled, ...props }) {
  return (
    <button className={`button button--${variant}`} disabled={disabled || loading} {...props}>
      {loading ? <Spinner label="Processando" /> : children}
    </button>
  );
}

export function IconButton({ label, children, ...props }) {
  return (
    <button className="button button--secondary" aria-label={label} {...props}>
      {children}
    </button>
  );
}

export function FieldError({ id, children }) {
  return children ? (
    <span className="field__error" id={id} role="alert">
      {children}
    </span>
  ) : null;
}

export function Input({ label, error, description, id: suppliedId, ...props }) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const errorId = `${id}-error`;
  const descriptionId = `${id}-description`;
  const describedBy = [description && descriptionId, error && errorId].filter(Boolean).join(' ');
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {description && <span id={descriptionId}>{description}</span>}
      <input
        className="field__control"
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
        {...props}
      />
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
}

export function PasswordInput(props) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="stack">
      <Input {...props} type={visible ? 'text' : 'password'} />
      <button
        className="button button--secondary"
        type="button"
        onClick={() => setVisible(!visible)}
      >
        {visible ? 'Ocultar senha' : 'Mostrar senha'}
      </button>
    </div>
  );
}

export function Textarea({ label, error, id: suppliedId, ...props }) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <textarea className="field__control" id={id} aria-invalid={Boolean(error)} {...props} />
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

export function Card({ as: Element = 'article', className = '', children, ...props }) {
  return createElement(Element, { className: `card ${className}`.trim(), ...props }, children);
}
export function Badge({ children, tone = 'info' }) {
  return <span className={`badge status-${tone}`}>{children}</span>;
}
export function Alert({ children, type = 'info' }) {
  return (
    <div className={`alert alert--${type}`} role={type === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
export function Spinner({ label = 'Carregando' }) {
  return <span role="status">{label}…</span>;
}
export function Skeleton({ label = 'Carregando conteúdo' }) {
  return <div className="skeleton" role="status" aria-label={label} />;
}
export function EmptyState({ title, children, className = '' }) {
  return (
    <Card className={`empty-state ${className}`.trim()}>
      <h2>{title}</h2>
      {children}
    </Card>
  );
}

export function Dialog({ open, onClose, title, children }) {
  const ref = useRef(null);
  const previousFocus = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      previousFocus.current = document.activeElement;
      dialog.showModal();
      dialog.querySelector('button, input, textarea, [href]')?.focus();
    } else if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      className="dialog"
      ref={ref}
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={() => previousFocus.current?.focus()}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const focusable = [
          ...event.currentTarget.querySelectorAll(
            'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [href]',
          ),
        ];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      <div className="cluster">
        <h2 id="dialog-title">{title}</h2>
        <IconButton label="Fechar diálogo" onClick={onClose} type="button">
          ×
        </IconButton>
      </div>
      {children}
    </dialog>
  );
}

export function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="cluster" aria-label="Paginação">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Anterior
      </Button>
      <span aria-current="page">
        Página {page} de {totalPages}
      </span>
      <Button variant="secondary" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Próxima
      </Button>
    </nav>
  );
}

export function Stepper({ steps, current }) {
  return (
    <ol className="stepper" aria-label="Etapas do agendamento">
      {steps.map((step, index) => (
        <li
          className={`stepper__item${index < current ? ' stepper__item--complete' : ''}`}
          key={step}
          aria-current={index === current ? 'step' : undefined}
        >
          <span className="stepper__indicator" aria-hidden="true">
            {index < current ? '✓' : index + 1}
          </span>
          <span className="stepper__label">{step}</span>
          {index < current && <span className="sr-only"> — concluída</span>}
        </li>
      ))}
    </ol>
  );
}
