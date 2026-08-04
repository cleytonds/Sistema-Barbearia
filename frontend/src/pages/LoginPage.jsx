import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Button, Input, PasswordInput } from '../components/ui/index.jsx';
import { Container } from '../components/layout/index.jsx';
import { BrandMark } from '../components/brand/BrandMark.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { homeByRole, safeInternalPath } from '../routes/routeSecurity.js';
export default function LoginPage() {
  useDocumentTitle('Entrar');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { notify } = useToast();
  const [form, setForm] = useState({ email: '', senha: '' }),
    [error, setError] = useState(null),
    [loading, setLoading] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const usuario = await login(form.email.trim(), form.senha);
      notify('Login efetuado.', 'success');
      const from = safeInternalPath(location.state?.from?.pathname);
      navigate(usuario.perfil === 'cliente' && from ? from : homeByRole(usuario.perfil), {
        replace: true,
      });
    } catch {
      setError('E-mail ou senha inválidos.');
    } finally {
      setLoading(false);
    }
  }
  return (
    <Container as="section" className="page form-shell">
      <form className="form card" onSubmit={submit}>
        <BrandMark linked={false} variant="auth" />
        <h1>Entrar</h1>
        {error && <Alert type="error">{error}</Alert>}
        <Input
          label="E-mail"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <PasswordInput
          label="Senha"
          autoComplete="current-password"
          required
          value={form.senha}
          onChange={(e) => setForm({ ...form, senha: e.target.value })}
        />
        <Button type="submit" loading={loading}>
          Entrar
        </Button>
        <Link to="/esqueci-senha">Esqueci minha senha</Link>
        <Link to="/cadastro">Criar conta</Link>
      </form>
    </Container>
  );
}
