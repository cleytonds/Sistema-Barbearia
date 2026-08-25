# Elite Barbearia 081 — Apresentação para Portfólio e Entrevista

## 1. Resumo profissional

A Elite Barbearia 081 é um sistema full stack de agendamento e gestão operacional para uma barbearia real.

O projeto integra:

```text
React
Node.js
Express
MySQL
JWT
Vercel
Railway
Brevo
```

e foi desenvolvido com foco em regras reais de negócio, segurança, concorrência, autenticação e operação em produção.

---

## 2. O problema

Uma barbearia precisa organizar:

- serviços;
- profissionais;
- jornadas;
- disponibilidade;
- clientes;
- agendamentos;
- cancelamentos;
- planos mensais;
- comissões.

O sistema centraliza essas operações e reduz dependência de controle manual.

---

## 3. Arquitetura

```text
React / Vite
    ↓
Axios
    ↓
API REST
    ↓
Express
    ↓
Controllers
    ↓
Services
    ↓
Domain / Repositories
    ↓
MySQL
```

Produção:

```text
Vercel
  ↓
/api proxy
  ↓
Railway
  ↓
MySQL
```

---

## 4. O que eu consigo explicar em entrevista

### Frontend

- componentes React;
- rotas;
- contexto de autenticação;
- serviços HTTP;
- loading/error;
- guards;
- responsividade;
- PWA.

### Backend

- rotas;
- controllers;
- services;
- repositories;
- validação;
- middlewares;
- autenticação;
- regras de domínio.

### Banco

- migrations;
- chaves estrangeiras;
- índices;
- snapshots;
- transações;
- locks;
- idempotência.

---

## 5. Autenticação

O sistema usa JWT em cookie HttpOnly.

Fluxo:

```text
login
 ↓
backend valida
 ↓
JWT
 ↓
cookie HttpOnly
 ↓
/auth/me
 ↓
sessão React
```

Também há:

- revogação;
- versão de autenticação;
- múltiplos papéis;
- CSRF;
- rate limit;
- recuperação de senha.

---

## 6. Problema técnico interessante: dupla reserva

Mostrar um horário como livre não garante que ele continuará livre.

Duas pessoas podem clicar quase ao mesmo tempo.

A solução não fica apenas no frontend.

O backend:

```text
abre transação
↓
bloqueia barbeiro
↓
revalida disponibilidade
↓
cria agendamento
↓
commit
```

Assim, requisições concorrentes do mesmo profissional são serializadas.

---

## 7. Idempotência

Se a rede cair depois do servidor criar um agendamento, o cliente pode tentar novamente.

Sem proteção:

```text
1 clique
+
retry
=
2 agendamentos
```

O sistema usa `Idempotency-Key` para que a mesma intenção possa ser repetida sem duplicar efeito.

---

## 8. Planos mensais

O cliente não escolhe "usar plano".

O backend decide automaticamente.

Valida:

- assinatura;
- pagamento;
- período;
- serviço;
- profissional;
- limite semanal;
- limite total.

Se não houver cobertura, o cliente continua como avulso.

---

## 9. Snapshots

Um aprendizado importante foi não depender de dados atuais para reconstruir o passado.

Exemplo:

```text
serviço hoje = R$ 50
agendamento antigo = R$ 40
```

O agendamento antigo precisa preservar R$ 40.

Por isso o sistema usa snapshots em domínios como agendamentos e planos.

---

## 10. Segurança

Proteções implementadas incluem:

- bcrypt;
- JWT;
- cookie HttpOnly;
- Secure;
- SameSite;
- CSRF;
- CORS;
- Helmet;
- rate limiting;
- SQL parametrizado;
- validação;
- autorização por papel;
- ownership;
- banco de teste isolado;
- segredos por variável de ambiente.

---

## 11. Deploy

Frontend:

```text
Vercel
```

Backend:

```text
Railway
```

Banco:

```text
MySQL Railway
```

E-mail:

```text
Brevo API HTTPS
```

O frontend usa proxy `/api` para manter o fluxo de autenticação same-origin.

---

## 12. Testes

O projeto possui testes de:

- autenticação;
- autorização;
- cookies;
- disponibilidade;
- agendamentos;
- concorrência;
- planos;
- comissões;
- frontend;
- build.

Também existe banco isolado para integração.

---

## 13. O que o projeto demonstra

- desenvolvimento full stack;
- API REST;
- React;
- Node/Express;
- MySQL;
- autenticação;
- segurança web;
- modelagem relacional;
- concorrência;
- transações;
- Git;
- deploy;
- troubleshooting;
- documentação técnica.

---

## 14. Resposta curta para recrutador

> Desenvolvi um sistema full stack de agendamento para uma barbearia real usando React, Node.js, Express e MySQL. O projeto possui autenticação segura por JWT em cookie HttpOnly, áreas de cliente, barbeiro e administrador, controle de disponibilidade e concorrência para evitar dupla reserva, planos mensais, comissões, testes automatizados e deploy em Vercel e Railway.

---

## 15. Resposta técnica um pouco maior

> O sistema segue uma arquitetura em camadas. No frontend uso React e serviços HTTP; no backend tenho rotas, controllers, services, domínio e repositories. O MySQL é acessado com consultas parametrizadas e migrations. Um dos pontos que mais trabalhei foi concorrência de agenda: a disponibilidade pública não é tratada como reserva, então na criação o backend abre transação, bloqueia o recurso do barbeiro e revalida conflitos antes do commit. Também implementei idempotência para evitar duplicidade em retries, autenticação com JWT em cookie HttpOnly, CSRF, múltiplos papéis e recuperação de senha via Brevo.

---

## 16. Como estudar o projeto

Escolha uma funcionalidade e siga o fluxo:

```text
Página React
 ↓
Hook
 ↓
Service frontend
 ↓
Endpoint
 ↓
Route
 ↓
Controller
 ↓
Service backend
 ↓
Repository
 ↓
SQL
```

Depois responda:

1. quem inicia?
2. qual payload?
3. quem valida?
4. onde está a regra?
5. qual tabela?
6. o que pode falhar?
7. qual status HTTP?
8. qual teste prova?

---

## 17. Perguntas que devo saber responder

- por que JWT está em cookie e não localStorage?
- o que é CSRF?
- diferença entre 401 e 403?
- por que usar transaction?
- o que é `FOR UPDATE`?
- como evitar dupla reserva?
- o que é idempotência?
- por que usar snapshot?
- o que faz um repository?
- diferença entre controller e service?
- por que não confiar no frontend?
- por que banco de teste separado?
- como funciona o deploy?

---

## 18. Evolução futura

A arquitetura atual é single-tenant.

Uma versão SaaS exigiria:

- entidade barbearia;
- isolamento de tenant;
- papéis por barbearia;
- testes de isolamento;
- staging;
- migração gradual.

Essa evolução foi conscientemente deixada fora da versão atual para preservar estabilidade.
