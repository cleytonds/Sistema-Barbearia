# Autenticação — Elite Barbearia 081

## 1. Objetivo

Este documento descreve o fluxo de autenticação da versão atual do sistema, incluindo cadastro, login, manutenção de sessão, múltiplos papéis, logout, alteração de senha e recuperação de senha.

A regra central é simples:

> o frontend controla navegação e experiência; o backend é a autoridade para identidade, sessão e autorização.

## 2. Componentes principais

### Frontend

Arquivos centrais:

- `frontend/src/contexts/AuthContext.jsx`
- `frontend/src/services/authService.js`
- `frontend/src/api/client.js`
- `frontend/src/routes/GuestRoute.jsx`
- `frontend/src/routes/ProtectedRoute.jsx`
- `frontend/src/routes/RoleRoute.jsx`

Responsabilidades:

- enviar credenciais;
- confirmar a sessão em `/api/auth/me`;
- manter o usuário autenticado no estado React;
- redirecionar conforme a área permitida;
- tratar `401` e `403` de forma diferente;
- nunca decidir autorização real apenas pelo navegador.

### Backend

Arquivos/conceitos centrais:

- `backend/src/routes/authRoutes.js`
- `backend/src/controllers/authController.js`
- `backend/src/services/authService.js`
- `backend/src/auth/authCookie.js`
- `backend/src/auth/jwtIssuer.js`
- `backend/src/auth/jwtVerifier.js`
- `backend/src/auth/jwtRevocation.js`
- `backend/src/auth/password.js`
- `backend/src/auth/recoveryToken.js`
- `backend/src/middlewares/auth.js`
- `backend/src/middlewares/authorize.js`
- `backend/src/repositories/userRepository.js`

## 3. Sessão por cookie

A sessão utiliza o cookie:

```text
barbearia_session
```

Em produção, o contrato do cookie é:

```text
HttpOnly = true
Secure   = true
SameSite = Lax
Path     = /
```

Consequências:

- JavaScript do navegador não precisa ler o JWT;
- o navegador envia o cookie automaticamente nas chamadas permitidas;
- o token não fica exposto em `localStorage`;
- o frontend usa `withCredentials`;
- a produção usa proxy `/api` na Vercel para manter a comunicação same-origin.

Fluxo simplificado:

```text
LoginPage
   |
   v
POST /api/auth/login
   |
   v
Backend valida e-mail + senha
   |
   v
JWT assinado
   |
   v
Set-Cookie: barbearia_session
   |
   v
GET /api/auth/me
   |
   v
Sessão confirmada
   |
   v
AuthContext atualiza estado
```

## 4. Cadastro

Rota:

```http
POST /api/auth/cadastro
```

O cadastro público cria apenas cliente. O frontend não pode enviar um papel administrativo para elevar privilégio.

Campos de identidade seguem validações próprias de nome, e-mail, telefone, senha e confirmação. Senhas são transformadas em hash com bcrypt antes da persistência.

## 5. Login

Rota:

```http
POST /api/auth/login
```

Fluxo:

1. validar payload;
2. normalizar e-mail;
3. localizar o usuário;
4. comparar senha com bcrypt;
5. validar que a conta está ativa;
6. carregar dados atuais do usuário;
7. emitir JWT;
8. gravar o JWT no cookie HttpOnly;
9. retornar somente dados públicos necessários.

O frontend não deve considerar o login concluído apenas porque o `POST /login` retornou sucesso. Depois do login, a aplicação confirma a sessão com:

```http
GET /api/auth/me
```

## 6. JWT

O JWT funciona como identificador assinado da sessão. Conceitualmente, contém dados mínimos como:

```json
{
  "sub": "ID_DO_USUARIO",
  "ver": 1,
  "jti": "IDENTIFICADOR_UNICO",
  "iss": "barbearia-api",
  "aud": "barbearia-web",
  "iat": 0,
  "exp": 0
}
```

Os papéis não são autoridade definitiva a partir de claims antigos. O backend revalida o estado atual do usuário e os papéis necessários.

## 7. `auth_versao`

A versão de autenticação permite invalidar sessões antigas sem depender apenas da expiração natural do JWT.

Exemplos:

- redefinição de senha;
- alteração de senha;
- mudança relevante de autorização.

Fluxo:

```text
JWT.ver
   |
   v
comparar com usuarios.auth_versao
   |
   +--> igual: continuar
   |
   +--> diferente: 401 / sessão inválida
```

## 8. Logout e revogação

Rota:

```http
POST /api/auth/logout
```

O logout revoga/invalida a sessão conforme o contrato atual, limpa o cookie e remove o estado de autenticação no frontend. Tokens revogados não devem voltar a ser aceitos mesmo que ainda não tenham expirado.

## 9. Múltiplos papéis

Papéis reconhecidos:

```text
cliente
barbeiro
admin
```

A relação moderna usa `usuarios -> usuario_papeis -> papeis`. Um usuário pode possuir mais de um papel.

Portanto:

> nunca selecionar área ou permissão apenas por `papeis[0]`.

## 10. Guardas no frontend

### `GuestRoute`

Impede que um usuário autenticado permaneça indevidamente em páginas destinadas a visitantes.

### `ProtectedRoute`

Espera o bootstrap da sessão e exige autenticação válida.

### `RoleRoute`

Verifica se o usuário possui o papel necessário para a área visual. Isso não substitui a autorização no backend.

## 11. Tratamento de `401` e `403`

### `401 Unauthorized`

Pode indicar cookie ausente, JWT inválido/expirado, sessão revogada, usuário desativado ou versão incompatível. O frontend deve limpar a sessão e redirecionar ao login.

### `403 Forbidden`

O usuário está autenticado, porém não possui autorização. A sessão deve ser mantida e a interface deve mostrar acesso negado.

## 12. CSRF

Como a autenticação utiliza cookie, mutações autenticadas precisam de proteção contra CSRF. O backend valida requisitos como origem permitida e header de proteção esperado para métodos não seguros.

## 13. Recuperação de senha

Rotas:

```http
POST /api/auth/esqueci-senha
POST /api/auth/redefinir-senha
```

Fluxo da solicitação:

```text
e-mail
  |
normalização
  |
resposta neutra
  |
se existir conta ativa:
  |
gerar token aleatório
  |
armazenar somente hash
  |
definir expiração
  |
enviar link por e-mail
```

A resposta é neutra para evitar enumeração de contas.

O token puro é enviado apenas ao usuário. No banco, persiste-se a representação segura/hash. O token possui expiração, é de uso único e não deve aparecer em logs.

## 14. E-mail de recuperação em produção

Em produção, o envio usa a API HTTPS da Brevo:

```text
Backend Railway
     |
     | HTTPS
     v
Brevo API
     |
     v
caixa de e-mail do usuário
```

A chave da Brevo existe apenas em variável de ambiente.

Nunca versionar:

```text
BREVO_API_KEY
JWT_SECRET
DB_PASSWORD
tokens de recuperação
senhas
```

## 15. Redefinição

Fluxo transacional:

1. receber token e nova senha;
2. gerar hash do token;
3. localizar token válido;
4. bloquear o registro necessário;
5. confirmar uso/expiração;
6. gerar novo hash bcrypt;
7. atualizar a senha;
8. incrementar `auth_versao`;
9. marcar o token como utilizado;
10. invalidar outros tokens pendentes;
11. commit.

Depois da redefinição, JWTs antigos deixam de ser válidos pela mudança de `auth_versao`.

## 16. Alteração de senha autenticada

Rota:

```http
PUT /api/auth/alterar-senha
```

Exige sessão válida, senha atual correta, nova senha válida, confirmação e alteração transacional.

## 17. Segurança de logs

Nunca registrar senha, `senha_hash`, JWT completo, cookie de autenticação, `BREVO_API_KEY`, token puro de recuperação ou senha de banco.

## 18. Resumo

```text
Credenciais
   ↓
Backend
   ↓
bcrypt + usuário ativo
   ↓
JWT
   ↓
Cookie HttpOnly
   ↓
/auth/me
   ↓
papéis reais
   ↓
ProtectedRoute / RoleRoute
   ↓
cliente | barbeiro | admin
```

Regra de manutenção: nenhuma decisão de autorização depende exclusivamente do frontend.
