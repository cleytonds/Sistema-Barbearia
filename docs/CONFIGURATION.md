# Configuração — Elite Barbearia 081

## 1. Objetivo

Este documento descreve as configurações de ambiente necessárias para executar e publicar o sistema sem expor valores secretos.

A aplicação possui dois ambientes principais:

```text
frontend
backend
```

e utiliza variáveis distintas em desenvolvimento, testes e produção.

> Nunca copie valores reais de produção para este documento, para o GitHub ou para arquivos versionados.

---

## 2. Arquivos de ambiente

Arquivos locais podem incluir:

```text
backend/.env
backend/.env.test
frontend/.env
```

Esses arquivos não devem ser versionados quando contêm valores reais.

Arquivos permitidos no repositório:

```text
backend/.env.example
frontend/.env.example
```

Eles devem conter apenas nomes de variáveis e exemplos fictícios.

---

## 3. Backend — ambiente geral

### `NODE_ENV`

Define o modo de execução.

Exemplos:

```env
NODE_ENV=development
NODE_ENV=test
NODE_ENV=production
```

Em produção:

```env
NODE_ENV=production
```

---

### `PORT`

Porta HTTP local.

Exemplo:

```env
PORT=3000
```

Na Railway, a porta de produção é fornecida pela plataforma e o servidor deve respeitar esse valor.

---

### `FRONTEND_URL`

Origem permitida do frontend.

Desenvolvimento:

```env
FRONTEND_URL=http://localhost:5173
```

Produção:

```env
FRONTEND_URL=https://sistema-barbearia-bice.vercel.app
```

Essa configuração participa de políticas de origem/CORS e proteção de requisições.

---

### `TRUST_PROXY`

Controla a confiança nos proxies anteriores ao Express.

Produção atual:

```env
TRUST_PROXY=1
```

Não usar valor irrestrito sem compreender a topologia da infraestrutura.

---

## 4. Banco de dados

Variáveis principais:

```env
DB_HOST=<host>
DB_PORT=<porta>
DB_USER=<usuario>
DB_PASSWORD=<segredo>
DB_NAME=<database>
DB_CONNECTION_LIMIT=<limite>
```

### Desenvolvimento

Banco utilizado:

```text
barbearia_agendamento
```

### Testes

Banco isolado:

```text
barbearia_agendamento_test
```

### Produção

Banco atual:

```text
railway
```

O nome do banco deve ser informado sem espaços acidentais.

Exemplo correto:

```env
DB_NAME=railway
```

Evitar:

```env
DB_NAME= railway
```

---

## 5. Proteção do banco de testes

A suíte de integração deve operar exclusivamente no banco isolado.

Antes de executar testes que alteram dados, confirme:

```text
NODE_ENV=test
DB_NAME=barbearia_agendamento_test
```

A proteção do projeto deve falhar de forma segura quando não consegue provar que o destino é um banco de teste.

Nunca contorne essa proteção para "fazer o teste passar".

---

## 6. Pool de conexões

### `DB_CONNECTION_LIMIT`

Define o limite de conexões do pool MySQL.

Exemplo:

```env
DB_CONNECTION_LIMIT=10
```

O valor deve ser compatível com:

- limite da infraestrutura;
- quantidade de instâncias;
- carga real;
- concorrência das operações.

---

## 7. JWT

Variáveis:

```env
JWT_SECRET=<segredo-longo-e-aleatorio>
JWT_EXPIRES_IN=15m
JWT_ISSUER=barbearia-api
JWT_AUDIENCE=barbearia-web
JWT_REVOCATION_CLEANUP_MINUTES=60
```

### `JWT_SECRET`

Obrigatório e secreto.

Nunca:

- versionar;
- enviar em screenshot;
- escrever em documentação;
- reutilizar valor fraco de exemplo em produção.

### `JWT_EXPIRES_IN`

Define a duração do token.

### `JWT_ISSUER`

Identifica o emissor esperado.

### `JWT_AUDIENCE`

Identifica o público esperado.

### `JWT_REVOCATION_CLEANUP_MINUTES`

Controla a rotina relacionada à limpeza de registros de revogação expirados.

---

## 8. Sessão

O cookie de produção usa o contrato:

```text
Nome:     barbearia_session
HttpOnly: true
Secure:   true
SameSite: Lax
Path:     /
```

Esses valores fazem parte do código/configuração da aplicação, não de uma variável que deva ser reduzida para resolver problemas de integração.

---

## 9. E-mail — Brevo

Variáveis atuais:

```env
BREVO_API_KEY=<api-key>
EMAIL_FROM=<remetente-verificado>
EMAIL_FROM_NAME=Elite Barbearia 081
```

### `BREVO_API_KEY`

Credencial secreta da API HTTPS.

Nunca versionar.

### `EMAIL_FROM`

Precisa corresponder a um remetente autorizado/verificado no provedor.

### `EMAIL_FROM_NAME`

Nome apresentado ao destinatário.

O fluxo atual de recuperação usa API HTTPS da Brevo, e não conexão SMTP direta.

---

## 10. Frontend

Variável principal:

```env
VITE_API_URL=<base-da-api>
```

### Desenvolvimento

```env
VITE_API_URL=http://localhost:3000/api
```

### Produção

```env
VITE_API_URL=/api
```

Em produção, `/api` é encaminhado pela Vercel ao backend Railway.

---

## 11. Por que `/api` em produção

Fluxo:

```text
Browser
  ↓
https://sistema-barbearia-bice.vercel.app/api/...
  ↓
Vercel Rewrite
  ↓
Railway Backend
```

Benefícios:

- sessão same-origin no navegador;
- compatibilidade com `SameSite=Lax`;
- frontend não precisa conhecer diretamente a origem Railway;
- configuração centralizada.

---

## 12. Vercel

Configuração conceitual:

```text
Root Directory: frontend
Framework: Vite
Build: npm run build
Output: dist
```

Variável:

```env
VITE_API_URL=/api
```

O rewrite de API precisa ocorrer antes do fallback SPA.

---

## 13. Railway

Backend:

```text
Service: Sistema-Barbearia
Environment: production
```

O serviço utiliza:

- variáveis do banco;
- JWT;
- `FRONTEND_URL`;
- `TRUST_PROXY`;
- Brevo.

Segredos devem ser gerenciados pelo painel/ambiente Railway, não pelo Git.

---

## 14. Configuração mínima de desenvolvimento

Exemplo fictício:

```env
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=<usuario-local>
DB_PASSWORD=<senha-local>
DB_NAME=barbearia_agendamento
DB_CONNECTION_LIMIT=10

JWT_SECRET=<segredo-local-comprido>
JWT_EXPIRES_IN=15m
JWT_ISSUER=barbearia-api
JWT_AUDIENCE=barbearia-web
JWT_REVOCATION_CLEANUP_MINUTES=60

BREVO_API_KEY=<somente-se-necessario>
EMAIL_FROM=<remetente-de-teste>
EMAIL_FROM_NAME=Elite Barbearia 081
```

---

## 15. Configuração mínima de testes

Exemplo conceitual:

```env
NODE_ENV=test

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=<usuario-de-teste>
DB_PASSWORD=<senha-de-teste>
DB_NAME=barbearia_agendamento_test

JWT_SECRET=<segredo-efemero-de-teste>
JWT_EXPIRES_IN=15m
JWT_ISSUER=barbearia-api
JWT_AUDIENCE=barbearia-web
```

APIs externas devem ser mockadas em testes automatizados.

---

## 16. Validação antes de iniciar produção

Checklist:

```text
[ ] NODE_ENV=production
[ ] DB_HOST correto
[ ] DB_PORT correto
[ ] DB_NAME correto
[ ] DB_USER correto
[ ] DB_PASSWORD presente, quando exigida pelo provedor/autenticação
[ ] JWT_SECRET forte
[ ] JWT_ISSUER correto
[ ] JWT_AUDIENCE correto
[ ] FRONTEND_URL correto
[ ] TRUST_PROXY explícito
[ ] BREVO_API_KEY presente
[ ] EMAIL_FROM verificado
```

Depois validar:

```text
GET /api/health
GET /api/ready
```

---

## 17. Rotação de segredos

Se uma credencial for exposta:

1. considerar a credencial comprometida;
2. gerar uma nova;
3. atualizar o ambiente;
4. fazer redeploy;
5. testar;
6. revogar/remover a antiga;
7. verificar histórico Git e logs;
8. não publicar o novo valor em mensagens.

---

## 18. Regra de ouro

Configuração pode ser documentada.

Segredo não.
