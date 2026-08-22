import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Container } from '../components/layout/index.jsx';
import { BrandMark } from '../components/brand/BrandMark.jsx';
import { Alert, Button, PasswordInput } from '../components/ui/index.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { apiError } from '../utils/apiError.js';

export function validateNewPassword(password) {
  if (password.length < 8 || password.length > 72)
    return 'A senha deve ter entre 8 e 72 caracteres.';
  if (!/[A-Za-zÀ-ÿ]/.test(password)) return 'A senha deve conter pelo menos uma letra.';
  if (!/\d/.test(password)) return 'A senha deve conter pelo menos um número.';
  return null;
}

export function resetPasswordErrorMessage(requestError) {
  const parsed = apiError(requestError);
  const validationMessage = parsed.fieldErrors.novaSenha ?? parsed.fieldErrors.confirmacaoNovaSenha;
  if (validationMessage) return `A nova senha ${validationMessage}.`;
  if (parsed.code === 'INVALID_RECOVERY_TOKEN') return 'Link inválido ou expirado.';
  if (parsed.code === 'PASSWORD_UNCHANGED')
    return 'A nova senha deve ser diferente da senha atual.';
  if (requestError.response?.status === 429)
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  if (!requestError.response)
    return 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';
  return 'Não foi possível redefinir a senha. Tente novamente.';
}

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
    const passwordError = validateNewPassword(form.novaSenha);
    if (passwordError) return setError(passwordError);
    if (form.novaSenha !== form.confirmacaoNovaSenha) return setError('As senhas não conferem.');
    setLoading(true);
    try {
      await resetPassword({ token, ...form });
      setSuccess(true);
    } catch (requestError) {
      setError(resetPasswordErrorMessage(requestError));
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
