import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Input, PasswordInput } from '../components/ui/index.jsx';
import { Container } from '../components/layout/index.jsx';
import { BrandMark } from '../components/brand/BrandMark.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { apiError } from '../utils/apiError.js';
const digits = (value) => value.replace(/\D/g, '').slice(0, 11);

const fieldLabels = {
  nome: 'O nome',
  email: 'O e-mail',
  telefone: 'O telefone',
  senha: 'A senha',
  confirmacaoSenha: 'A confirmação da senha',
};

function friendlyFieldError(field, message) {
  if (field === 'confirmacaoSenha' && message.includes('não confere'))
    return 'A confirmação deve ser igual à senha.';
  if (field === 'senha' && message.includes('deve conter uma letra'))
    return 'A senha deve conter pelo menos uma letra.';
  if (field === 'senha' && message.includes('deve conter um número'))
    return 'A senha deve conter pelo menos um número.';
  if (field === 'senha' && message.includes('entre 8 e 72'))
    return 'A senha deve ter entre 8 e 72 caracteres.';
  return `${fieldLabels[field] ?? 'Este campo'} ${message}.`;
}

export function validateRegistrationForm(form) {
  const errors = {};
  if (form.senha.length < 8 || form.senha.length > 72)
    errors.senha = 'A senha deve ter entre 8 e 72 caracteres.';
  else if (!/[A-Za-zÀ-ÿ]/.test(form.senha))
    errors.senha = 'A senha deve conter pelo menos uma letra.';
  else if (!/\d/.test(form.senha)) errors.senha = 'A senha deve conter pelo menos um número.';
  if (form.senha !== form.confirmacaoSenha)
    errors.confirmacaoSenha = 'A confirmação deve ser igual à senha.';
  return errors;
}

export function registrationPayload(form) {
  return {
    nome: form.nome,
    email: form.email,
    telefone: digits(form.telefone),
    senha: form.senha,
    confirmacaoSenha: form.confirmacaoSenha,
  };
}

export default function RegisterPage() {
  useDocumentTitle('Cadastro');
  const { register } = useAuth();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [form, setForm] = useState({
      nome: '',
      email: '',
      telefone: '',
      senha: '',
      confirmacaoSenha: '',
    }),
    [error, setError] = useState(null),
    [fieldErrors, setFieldErrors] = useState({}),
    [loading, setLoading] = useState(false);
  function change(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
    setError(null);
  }
  async function submit(event) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    const validationErrors = validateRegistrationForm(form);
    if (Object.keys(validationErrors).length) {
      setFieldErrors(validationErrors);
      setError('Confira os dados informados.');
      return;
    }
    setLoading(true);
    try {
      await register(registrationPayload(form));
      notify('Cadastro concluído.', 'success');
      navigate('/meus-agendamentos', { replace: true });
    } catch (requestError) {
      const normalized = apiError(requestError, 'Não foi possível concluir o cadastro.');
      setFieldErrors(
        Object.fromEntries(
          Object.entries(normalized.fieldErrors).map(([field, message]) => [
            field,
            friendlyFieldError(field, message),
          ]),
        ),
      );
      setError(
        normalized.message === 'Dados inválidos.'
          ? 'Confira os dados informados.'
          : normalized.message,
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <Container as="section" className="page form-shell">
      <form className="form card" onSubmit={submit}>
        <BrandMark linked={false} variant="auth" />
        <h1>Criar conta</h1>
        {error && (
          <div aria-live="assertive">
            <Alert type="error">{error}</Alert>
          </div>
        )}
        <Input
          label="Nome"
          required
          minLength="3"
          error={fieldErrors.nome}
          value={form.nome}
          onChange={(e) => change('nome', e.target.value)}
        />
        <Input
          label="E-mail"
          type="email"
          required
          error={fieldErrors.email}
          value={form.email}
          onChange={(e) => change('email', e.target.value)}
        />
        <Input
          label="Telefone"
          inputMode="tel"
          required
          error={fieldErrors.telefone}
          value={form.telefone}
          onChange={(e) => change('telefone', e.target.value)}
        />
        <PasswordInput
          label="Senha"
          description="Use 8 a 72 caracteres, com uma letra e um número."
          required
          minLength="8"
          maxLength="72"
          error={fieldErrors.senha}
          value={form.senha}
          onChange={(e) => change('senha', e.target.value)}
        />
        <PasswordInput
          label="Confirmar senha"
          required
          error={fieldErrors.confirmacaoSenha}
          value={form.confirmacaoSenha}
          onChange={(e) => change('confirmacaoSenha', e.target.value)}
        />
        <Button type="submit" loading={loading}>
          Criar conta
        </Button>
        <Link to="/login">Já tenho uma conta</Link>
      </form>
    </Container>
  );
}
