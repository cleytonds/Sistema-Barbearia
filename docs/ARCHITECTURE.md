# Arquitetura — Elite Barbearia 081

## 1. Objetivo

Este documento descreve a arquitetura técnica da versão atual do sistema da Elite Barbearia 081, incluindo frontend, backend, banco, autenticação, comunicação entre serviços, regras de concorrência e infraestrutura de produção.

A versão atual é **single-tenant**: atende uma barbearia. A futura arquitetura multi-barbearia está fora do escopo da produção atual.

## 2. Visão geral

```text
                         +-------------------------+
                         |       Navegador         |
                         | Desktop / Mobile / PWA  |
                         +------------+------------+
                                      |
                                   HTTPS
                                      |
                                      v
                         +-------------------------+
                         |         Vercel          |
                         | React 19 + Vite         |
                         | React Router + Axios    |
                         +------------+------------+
                                      |
                     same-origin      | /api/*
                       proxy          v
                         +-------------------------+
                         |        Railway          |
                         | Node.js + Express 5     |
                         +-----------+-------------+
                                     |
                       +-------------+-------------+
                       |                           |
                       v                           v
              +-----------------+        +------------------+
              | Railway MySQL   |        | Brevo HTTPS API  |
              | Persistência    |        | E-mail transac.  |
              +-----------------+        +------------------+
```

## 3. Frontend

### 3.1 Tecnologias

- React 19;
- Vite;
- React Router;
- Axios;
- PWA;
- componentes e CSS responsivos próprios.

### 3.2 Responsabilidades

O frontend é responsável por:

- apresentação da interface;
- navegação entre áreas públicas e privadas;
- coleta e validação básica de formulário;
- consumo da API;
- estado de sessão no React;
- feedback de loading, vazio, erro e sucesso;
- acessibilidade e comportamento responsivo.

O frontend **não é fonte de verdade para autorização**. Um usuário esconder ou exibir um botão não define permissão; a API valida novamente todas as operações protegidas.

### 3.3 Áreas de navegação

```text
Público
  /              início
  /agendar       fluxo de agendamento
  /planos        planos públicos
  /login         autenticação
  /cadastro      cadastro de cliente
  /esqueci-senha recuperação

Cliente autenticado
  /meus-agendamentos
  /meu-plano
  ...

Barbeiro
  /barbeiro
  /barbeiro/agenda
  /barbeiro/agendamentos/:id
  /barbeiro/jornada
  /barbeiro/bloqueios
  /barbeiro/perfil

Administrador
  /admin
  /admin/agendamentos
  /admin/servicos
  /admin/barbeiros
  /admin/funcionamento
  /admin/jornadas
  /admin/bloqueios
  /admin/configuracoes
  /admin/planos
  /admin/assinaturas
  ...
```

Rotas protegidas utilizam guardas equivalentes a `ProtectedRoute` e `RoleRoute`. O bootstrap da aplicação confirma a sessão por `/api/auth/me` antes de assumir o usuário como autenticado.

### 3.4 Cliente HTTP

A instância Axios centraliza o acesso à API e permanece configurada para enviar credenciais (`withCredentials`).

Em desenvolvimento, a URL pode ser absoluta:

```env
VITE_API_URL=http://localhost:3000/api
```

Em produção:

```env
VITE_API_URL=/api
```

## 4. Proxy same-origin na Vercel

Frontend e backend estão hospedados em provedores diferentes. Como a sessão utiliza cookie `SameSite=Lax`, chamadas diretas de `vercel.app` para `up.railway.app` criariam uma relação cross-site indesejada para o fluxo de autenticação.

A solução de produção é:

```text
Browser
  -> https://sistema-barbearia-bice.vercel.app/api/...
  -> rewrite Vercel
  -> https://sistema-barbearia-production-7801.up.railway.app/api/...
```

Para o navegador, a chamada permanece na mesma origem do frontend. O rewrite `/api/*` deve vir antes do fallback SPA para `/index.html`.

## 5. Backend

### 5.1 Tecnologias

- Node.js;
- ES Modules;
- Express 5;
- `mysql2/promise`;
- JWT;
- bcrypt;
- Helmet;
- CORS;
- rate limiting;
- `express-validator`;
- Luxon.

### 5.2 Pipeline HTTP

A aplicação Express segue, conceitualmente, esta ordem:

```text
request
  -> request context / request id
  -> Helmet
  -> CORS com credentials
  -> parser JSON (limite controlado)
  -> rotas em /api
  -> notFound
  -> errorHandler
```

O backend remove o header de identificação padrão do Express (`x-powered-by`).

## 6. Arquitetura em camadas

O padrão principal é:

```text
Route -> Controller -> Service -> Repository -> MySQL
                         |
                         +-> Domain
```

### Route

- declara método e caminho;
- compõe middlewares;
- aplica autenticação/autorização/validação adequadas.

### Controller

- extrai dados HTTP já validados;
- chama o service;
- define status e formato de resposta;
- não concentra regra de negócio.

### Service

- contém regras de negócio;
- resolve autorização contextual;
- coordena transações;
- coordena idempotência e efeitos relacionados;
- chama repositories e regras de domínio.

### Repository

- concentra SQL parametrizado;
- recebe pool ou connection quando necessário;
- não decide regras de negócio;
- não inicia transações por conta própria.

### Domain

- concentra regras puras e determinísticas;
- não depende de Express, banco ou ambiente;
- é usado especialmente em disponibilidade, agendamento, planos e regras temporais.

## 7. Banco e acesso a dados

O backend utiliza pool `mysql2/promise` com:

- espera por conexões;
- keepalive;
- timeout de conexão;
- timezone de sessão alinhado a UTC;
- limite de conexões configurável.

O schema é controlado por migrations e uma tabela `schema_migrations` com checksum.

Mais detalhes em [DATABASE.md](DATABASE.md).

## 8. Autenticação

### 8.1 Sessão

O JWT é armazenado no cookie:

```text
barbearia_session
```

Opções:

```text
HttpOnly = true
Secure   = true em produção
SameSite = Lax
Path     = /
```

O JavaScript do navegador não precisa acessar o JWT diretamente.

### 8.2 Fluxo de login

```text
POST /api/auth/login
  -> validar e-mail/senha
  -> validar usuário ativo
  -> emitir JWT
  -> Set-Cookie HttpOnly
  -> frontend chama GET /api/auth/me
  -> somente após /auth/me = 200 o estado React é autenticado
```

Essa confirmação evita um “falso sucesso” de login em caso de falha de persistência da sessão.

### 8.3 Papéis

O sistema suporta:

```text
cliente
barbeiro
admin
```

Um usuário pode acumular papéis. A autorização efetiva consulta o estado atual do usuário e seus papéis no backend; não depende de um valor manipulável do frontend.

### 8.4 401 x 403

- **401**: sessão ausente, inválida, expirada ou revogada;
- **403**: sessão válida, mas sem autorização para o recurso/operação.

Um `403` não deve ser tratado como logout automático.

## 9. CSRF, CORS e confiança de proxy

A proteção de sessão é acompanhada por controles de CSRF/Origin para operações mutáveis. O CORS aceita apenas origens configuradas e permite credenciais.

Em produção na Railway, `TRUST_PROXY` é explicitamente configurado. Isso é importante para IP real, HTTPS e rate limiting atrás do proxy da plataforma.

## 10. Disponibilidade

A rota pública de disponibilidade recebe profissional, serviço e data.

Conceitualmente:

```text
GET /api/disponibilidade?barbeiroId=...&servicoId=...&data=YYYY-MM-DD
```

O serviço:

1. carrega configuração da barbearia;
2. interpreta a data no fuso configurado;
3. valida antecedência;
4. carrega profissional, serviço e vínculo;
5. carrega funcionamento e jornada;
6. considera pausas;
7. considera bloqueios globais e individuais;
8. considera agendamentos ativos;
9. gera candidatos em intervalos de 15 minutos;
10. devolve somente os horários disponíveis.

A resposta de disponibilidade **não reserva** o horário.

## 11. Criação de agendamento

A garantia contra dupla reserva acontece na criação real, dentro da transação.

```text
POST /api/agendamentos
  -> iniciar transação
  -> lock do profissional (FOR UPDATE)
  -> validar ator e cliente
  -> validar profissional/serviço/vínculo
  -> revalidar disponibilidade
  -> decidir plano x avulso
  -> persistir snapshots
  -> criar agendamento
  -> reservar utilização do plano, se aplicável
  -> registrar histórico
  -> commit
```

Qualquer falha provoca rollback.

### Idempotência

Operações críticas de criação utilizam `Idempotency-Key`. A chave não deve ser persistida em texto puro; o backend trabalha com hashes de chave e payload para distinguir:

- replay legítimo do mesmo pedido;
- reutilização indevida da mesma chave com outro payload.

## 12. Máquina de estados do agendamento

Estados operacionais incluem:

```text
pendente
confirmado
em_atendimento
concluido
cancelado
ausente
```

As transições são validadas no backend. Alterações relevantes registram histórico na mesma transação da operação principal.

## 13. Datas, horários e fuso

A política do sistema separa:

- **instantes concretos**: armazenados em UTC em campos `DATETIME(6)`;
- **horários recorrentes**: armazenados como `TIME` civil local;
- **fuso da barbearia**: configuração de domínio, atualmente `America/Recife`.

Isso reduz dependência do timezone do servidor e mantém os cálculos de agenda previsíveis.

## 14. Planos mensais

Planos são um domínio separado do agendamento, mas integrado à decisão de cobrança.

Fluxo geral:

```text
plano
  -> assinatura do cliente
      -> pagamento presencial confirmado por admin
          -> assinatura ativa
              -> agendamento elegível
                  -> uso reservado
                      -> consumido ou liberado
```

Regras importantes:

- não há renovação automática;
- pagamento é presencial e confirmado pelo administrador;
- o frontend não força `tipo_cobranca`;
- o backend decide plano x avulso;
- cliente sem cobertura ainda pode agendar avulso;
- assinaturas preservam snapshots de condições contratadas;
- usos passam por `reservado`, `consumido` ou `liberado`.

## 15. E-mail transacional

A recuperação de senha em produção utiliza a API HTTPS da Brevo.

```text
backend Railway
   -> POST HTTPS Brevo API
   -> remetente verificado
   -> e-mail de redefinição
```

Variáveis relevantes:

```env
BREVO_API_KEY=<segredo>
EMAIL_FROM=<remetente>
EMAIL_FROM_NAME=Elite Barbearia 081
```

A API key nunca deve ser registrada em logs ou respostas.

## 16. Health e readiness

```text
GET /api/health
GET /api/ready
```

### `/api/health`

Indica que o processo HTTP está vivo.

### `/api/ready`

Confirma pré-condições para receber tráfego, incluindo conectividade com banco, schema esperado e configuração obrigatória da aplicação.

## 17. Deploy

### Frontend

```text
GitHub -> Vercel -> Vite build -> CDN
```

### Backend

```text
GitHub -> Railway -> Dockerfile -> Node.js -> Express
```

### Banco

```text
Railway MySQL + volume persistente
```

O banco não precisa de acesso público para a aplicação. Para operações administrativas pontuais, deve-se preferir túnel seguro/CLI em vez de expor o MySQL à internet.

## 18. Logs e erros

O sistema utiliza tratamento centralizado e evita expor stack em respostas de produção.

Convenções HTTP principais:

| Status | Significado |
|---|---|
| 400/422 | entrada inválida ou regra de negócio |
| 401 | sessão ausente/inválida |
| 403 | sessão válida sem permissão |
| 404 | recurso não encontrado/inacessível |
| 409 | conflito, duplicidade ou idempotência |
| 429 | limite de requisições |
| 500 | erro interno sanitizado |

Segredos, senhas, JWTs, API keys e tokens de recuperação não devem aparecer em logs.

## 19. Limitações arquiteturais atuais

- uma única barbearia por instalação;
- configuração principal é singleton;
- rate limiting em memória é adequado para uma única réplica, mas deve usar store compartilhado antes de escalar horizontalmente;
- multi-tenancy ainda não está implementado;
- grandes mudanças estruturais devem ser desenvolvidas fora do ambiente de produção.

## 20. Evolução futura

O roadmap multi-barbearia deve introduzir, de forma gradual:

- entidade `barbearias`;
- `barbearia_id` nas entidades de domínio;
- papéis por estabelecimento;
- isolamento obrigatório de consultas por tenant;
- configuração por barbearia;
- painel de administração da plataforma;
- testes automatizados de isolamento entre tenants.

Nenhuma dessas mudanças deve ser aplicada diretamente sobre a produção atual sem ambiente de staging e plano de migração.
