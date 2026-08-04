import assert from 'node:assert/strict';
import test from 'node:test';
import { registrationPayload, validateRegistrationForm } from '../src/pages/RegisterPage.jsx';
import { apiError } from '../src/utils/apiError.js';

const form = (senha, confirmacaoSenha = senha) => ({ senha, confirmacaoSenha });

test('cadastro rejeita senha sem letra', () => {
  assert.equal(
    validateRegistrationForm(form('12345678')).senha,
    'A senha deve conter pelo menos uma letra.',
  );
});

test('cadastro rejeita senha sem número', () => {
  assert.equal(
    validateRegistrationForm(form('abcdefgh')).senha,
    'A senha deve conter pelo menos um número.',
  );
});

test('cadastro rejeita senha curta e confirmação diferente', () => {
  const errors = validateRegistrationForm(form('Abc1', 'Abc2'));
  assert.equal(errors.senha, 'A senha deve ter entre 8 e 72 caracteres.');
  assert.equal(errors.confirmacaoSenha, 'A confirmação deve ser igual à senha.');
});

test('cadastro envia somente os cinco campos aceitos pelo backend', () => {
  const payload = registrationPayload({
    nome: 'Cliente',
    email: 'cliente@example.com',
    telefone: '(19) 99999-9999',
    senha: 'Senha123',
    confirmacaoSenha: 'Senha123',
    perfil: 'administrador',
    campoExtra: 'não enviar',
  });
  assert.deepEqual(payload, {
    nome: 'Cliente',
    email: 'cliente@example.com',
    telefone: '19999999999',
    senha: 'Senha123',
    confirmacaoSenha: 'Senha123',
  });
});

test('normaliza duplicidade de e-mail informada por campo', () => {
  const result = apiError({
    response: {
      data: {
        error: {
          message: 'Este e-mail já está cadastrado.',
          details: [{ campo: 'email', mensagem: 'já está cadastrado' }],
        },
      },
    },
  });
  assert.equal(result.message, 'Este e-mail já está cadastrado.');
  assert.equal(result.fieldErrors.email, 'já está cadastrado');
});

test('normaliza duplicidade de telefone informada por campo', () => {
  const result = apiError({
    response: {
      data: {
        error: {
          message: 'Este telefone já está cadastrado.',
          details: [{ field: 'telefone', message: 'já está cadastrado' }],
        },
      },
    },
  });
  assert.equal(result.message, 'Este telefone já está cadastrado.');
  assert.equal(result.fieldErrors.telefone, 'já está cadastrado');
});

test('prioriza mensagem segura do contrato 422', () => {
  const result = apiError({
    message: 'Request failed with status code 422',
    response: { data: { error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } } },
  });
  assert.equal(result.message, 'Dados inválidos.');
  assert.doesNotMatch(result.message, /Request failed/);
});

test('usa fallback seguro sem mensagem da API', () => {
  const result = apiError(
    { message: 'Request failed with status code 422', response: { data: {} } },
    'Não foi possível concluir o cadastro.',
  );
  assert.equal(result.message, 'Não foi possível concluir o cadastro.');
  assert.doesNotMatch(JSON.stringify(result), /Request failed|stack/i);
});
