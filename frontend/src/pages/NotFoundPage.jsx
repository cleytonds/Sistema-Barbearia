import { Link } from 'react-router-dom';
import { Container } from '../components/layout/index.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
export default function NotFoundPage() {
  useDocumentTitle('Página não encontrada');
  return (
    <Container as="section" className="page">
      <p className="eyebrow">Erro 404</p>
      <h1>Página não encontrada.</h1>
      <p>O endereço informado não existe.</p>
      <Link className="button button--primary" to="/">
        Voltar ao início
      </Link>
    </Container>
  );
}
