import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Container } from '../components/layout/index.jsx';
import { BrandMark } from '../components/brand/BrandMark.jsx';
import { Alert, Button, PasswordInput } from '../components/ui/index.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
export default function ResetPasswordPage() {
  useDocumentTitle('Redefinir senha');
  const { resetPassword } = useAuth();
  const [params] = useSearchParams();
  const token = params.get('token');
  const [form, setForm] = useState({ novaSenha: '', confirmacaoNovaSenha: '' }),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(null),
    [success, setSuccess] = useState(false);
  async function submit(e) {
    e.preventDefault();
    if (!token) return setError('Link inválido ou expirado.');
    if (form.novaSenha !== form.confirmacaoNovaSenha) return setError('As senhas não conferem.');
    setLoading(true);
    try {
      await resetPassword({ token, ...form });
      setSuccess(true);
    } catch {
      setError('Link inválido ou expirado.');
    } finally {
      setLoading(false);
    }
  }
  return (
    <Container as="section" className="page form-shell">
      <form className="form card" onSubmit={submit}>
        <BrandMark linked={false} variant="auth" />
        <h1>Redefinir senha</h1>
        {error && <Alert type="error">{error}</Alert>}
        {success ? (
          <>
            <Alert>Senha redefinida com sucesso.</Alert>
            <Link to="/login">Entrar</Link>
          </>
        ) : (
          <>
            <PasswordInput
              label="Nova senha"
              required
              minLength="8"
              value={form.novaSenha}
              onChange={(e) => setForm({ ...form, novaSenha: e.target.value })}
            />
            <PasswordInput
              label="Confirmar nova senha"
              required
              value={form.confirmacaoNovaSenha}
              onChange={(e) => setForm({ ...form, confirmacaoNovaSenha: e.target.value })}
            />
            <Button type="submit" loading={loading}>
              Redefinir senha
            </Button>
          </>
        )}
      </form>
    </Container>
  );
}
