import { useState } from 'react';
import { Link } from 'react-router-dom';
import logoUrl from '../../assets/brand/elite-barbearia-081-logo.jpg';

/** Ponto único de integração e fallback da logo oficial. */
export function BrandMark({ linked = true, to = '/', variant = 'header', loading = 'eager' }) {
  const [failed, setFailed] = useState(false);
  const content = (
    <span className={`brand-mark brand-mark--${variant}`}>
      {!failed && (
        <img
          className="brand-mark__image"
          src={logoUrl}
          alt="Elite Barbearia 081"
          width="1024"
          height="1024"
          loading={loading}
          onError={() => setFailed(true)}
        />
      )}
      {failed && <span className="brand-mark__fallback">Elite Barbearia 081</span>}
    </span>
  );
  return linked ? (
    <Link to={to} aria-label="Elite Barbearia 081 — início">
      {content}
    </Link>
  ) : (
    content
  );
}
