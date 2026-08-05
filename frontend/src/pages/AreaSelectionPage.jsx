import { Link, Navigate } from 'react-router-dom';
import { Container } from '../components/layout/index.jsx';
import { Card } from '../components/ui/index.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { destinationByRoles } from '../routes/routeSecurity.js';

export default function AreaSelectionPage() {
  useDocumentTitle('Selecionar área');
  const { usuario, hasRole } = useAuth();
  if (!(hasRole('barbeiro') && hasRole('admin')))
    return <Navigate to={destinationByRoles(usuario)} replace />;
  return (
    <Container as="main" className="page stack area-selection">
      <div>
        <p className="eyebrow">Escolha de acesso</p>
        <h1>Qual área você deseja acessar?</h1>
        <p>A escolha apenas define seu destino e não altera suas permissões.</p>
      </div>
      <div className="grid">
        <Card>
          <h2>Área do barbeiro</h2>
          <p>Ver minha agenda e meus atendimentos</p>
          <Link className="button button--primary" to="/barbeiro">
            Acessar área do barbeiro
          </Link>
        </Card>
        <Card>
          <h2>Painel administrativo</h2>
          <p>Gerenciar a barbearia</p>
          <Link className="button button--primary" to="/admin">
            Acessar painel administrativo
          </Link>
        </Card>
      </div>
    </Container>
  );
}
