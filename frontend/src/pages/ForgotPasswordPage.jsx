import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Container } from '../components/layout/index.jsx';
import { BrandMark } from '../components/brand/BrandMark.jsx';
import { Alert, Button, Input } from '../components/ui/index.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
export default function ForgotPasswordPage() {
  useDocumentTitle('Recuperar senha');
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState(''),
    [loading, setLoading] = useState(false),
    [sent, setSent] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await forgotPassword(email);
    } finally {
      setSent(true);
      setLoading(false);
    }
  }
  return (
    <Container as="section" className="page form-shell">
      <form className="form card" onSubmit={submit}>
        <BrandMark linked={false} variant="auth" />
        <h1>Recuperar senha</h1>
        {sent && <Alert>Se o e-mail estiver cadastrado, enviaremos as instruções.</Alert>}
        <Input
          label="E-mail"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" loading={loading}>
          Enviar instruções
        </Button>
        <Link to="/login">Voltar ao login</Link>
      </form>
    </Container>
  );
}
