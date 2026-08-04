import { Link } from 'react-router-dom';
import { Container } from '../components/layout/index.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useAuth } from '../hooks/useAuth.js';
import { homeByRole } from '../routes/routeSecurity.js';
export default function AccessDeniedPage() {
  useDocumentTitle('Acesso negado');
  const { usuario } = useAuth();
  return (
    <Container as="main" className="page">
      <h1>Acesso negado</h1>
      <p>Seu perfil não possui permissão para acessar esta área.</p>
      <Link className="button button--primary" to={homeByRole(usuario?.perfil)}>
        Voltar para minha área
      </Link>
    </Container>
  );
}
