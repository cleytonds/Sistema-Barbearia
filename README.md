# Elite Barbearia 081 — Sistema de Agendamento

Sistema full stack para gestão de uma barbearia, com agendamento online, áreas separadas para cliente, barbeiro e administrador, planos mensais, controle operacional e autenticação segura.

> **Status:** em produção, com foco atual em estabilidade operacional da Elite Barbearia 081.

## Produção

- **Frontend:** https://sistema-barbearia-bice.vercel.app
- **Backend:** Railway
- **Banco de dados:** MySQL na Railway
- **E-mail transacional:** Brevo via API HTTPS
- **Arquitetura atual:** single-tenant (uma barbearia)

A evolução para multi-barbearia/SaaS está planejada, mas não faz parte da versão de produção atual.

## Principais funcionalidades

### Cliente

- cadastro, login e logout;
- recuperação e redefinição de senha;
- consulta de serviços e profissionais;
- consulta de disponibilidade por data;
- criação de agendamento;
- proteção contra dupla reserva;
- cancelamento e reagendamento conforme regras de prazo;
- acompanhamento dos próprios agendamentos;
- consulta e adesão a planos mensais;
- acompanhamento da própria assinatura e utilizações.

### Barbeiro

- área operacional protegida;
- dashboard e agenda própria;
- consulta de detalhes dos próprios atendimentos;
- alteração controlada de status;
- consulta de jornada;
- criação e consulta de bloqueios permitidos;
- isolamento entre profissionais;
- comissão conforme regras administrativas;
- arquivamento operacional de atendimentos encerrados.

### Administrador

- dashboard operacional;
- gestão de agendamentos;
- criação manual de agendamento com idempotência;
- cancelamento e reagendamento administrativo;
- gestão de serviços;
- gestão de profissionais;
- vínculos entre profissionais e serviços;
- horários de funcionamento;
- jornadas individuais;
- bloqueios de agenda;
- configuração geral da barbearia;
- gestão de planos mensais e assinaturas;
- confirmação presencial de pagamentos de planos;
- acompanhamento de utilizações e histórico;
- gestão de comissões.

## Stack

### Frontend

- React 19
- Vite
- React Router
- Axios
- PWA
- CSS responsivo próprio

### Backend

- Node.js
- ES Modules
- Express 5
- `mysql2/promise`
- JWT
- `bcryptjs`
- Helmet
- CORS
- rate limiting
- `express-validator`
- Luxon

### Infraestrutura

- Vercel — frontend
- Railway — API
- Railway MySQL — banco de produção
- Brevo — e-mails transacionais via HTTPS

## Arquitetura resumida

```text
Navegador
   |
   | HTTPS
   v
Vercel — React/Vite
   |
   | /api/* (proxy same-origin)
   v
Railway — Node.js/Express
   |
   +------> MySQL Railway
   |
   +------> Brevo HTTPS API
```

A API é montada sob `/api`. Em produção, o frontend utiliza `/api` como URL-base; a Vercel encaminha as requisições ao backend da Railway. Isso mantém o navegador em uma origem consistente e permite o uso do cookie de sessão `SameSite=Lax` sem reduzir a proteção do cookie.

Mais detalhes: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Autenticação e papéis

O sistema utiliza JWT armazenado em cookie de sessão:

```text
barbearia_session
```

Em produção:

- `HttpOnly`;
- `Secure`;
- `SameSite=Lax`;
- `Path=/`.

Os papéis suportados são:

- `cliente`;
- `barbeiro`;
- `admin`.

Um usuário pode possuir mais de um papel. O frontend controla navegação e experiência, mas **a autorização efetiva é sempre validada pelo backend**.

A proteção inclui ainda:

- validação de usuário ativo;
- versão de autenticação;
- revogação de sessão/token;
- proteção CSRF nas operações aplicáveis;
- CORS com credenciais;
- rate limiting;
- respostas de erro sem exposição de stack ou segredos.

## Modelo arquitetural do backend

O fluxo padrão é:

```text
Route
  -> Controller
      -> Service
          -> Domain / Repository
              -> MySQL
```

Responsabilidades:

- **Route:** composição de endpoint e middlewares;
- **Controller:** contrato HTTP e serialização;
- **Service:** regra de negócio, autorização contextual e transações;
- **Repository:** SQL parametrizado e persistência;
- **Domain:** regras puras e determinísticas quando aplicável.

## Agendamento e concorrência

A disponibilidade pública é uma consulta, não uma reserva garantida. Na criação real do agendamento, o backend executa nova validação dentro de transação.

Fluxo simplificado:

```text
iniciar transação
  -> bloquear profissional
  -> validar cliente/profissional/serviço/vínculo
  -> validar funcionamento e jornada
  -> validar pausas e bloqueios
  -> revalidar conflitos
  -> decidir cobertura plano x avulso
  -> criar agendamento com snapshots
  -> reservar uso do plano, quando aplicável
  -> registrar histórico
commit
```

Em caso de erro, ocorre rollback. Operações críticas usam idempotência e locks para reduzir duplicidade e conflitos concorrentes.

## Banco de dados e migrations

O schema é gerenciado por migrations numeradas. A versão atual possui migrations `001` a `018`.

Comandos:

```powershell
npm.cmd run migrate:status --prefix backend
npm.cmd run migrate --prefix backend
```

Nunca edite uma migration já aplicada. Novas mudanças estruturais devem ser criadas em uma nova migration numerada.

Veja [docs/DATABASE.md](docs/DATABASE.md).

## Execução local

### Pré-requisitos

- Node.js compatível com o projeto;
- MySQL 8;
- npm;
- banco local configurado.

### Instalação

```powershell
npm.cmd install --prefix backend
npm.cmd install --prefix frontend
```

### Executar frontend e backend

```powershell
npm.cmd run dev
```

Ou separadamente:

```powershell
npm.cmd run dev --prefix backend
npm.cmd run dev --prefix frontend
```

## Variáveis de ambiente

Nunca versione `.env` real.

Exemplo conceitual para o backend em desenvolvimento:

```env
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173

DB_HOST=localhost
DB_PORT=3306
DB_USER=<usuario>
DB_PASSWORD=<segredo>
DB_NAME=barbearia_agendamento
DB_CONNECTION_LIMIT=10

JWT_SECRET=<segredo-longo-e-aleatorio>
JWT_EXPIRES_IN=15m
JWT_ISSUER=barbearia-api
JWT_AUDIENCE=barbearia-web
JWT_REVOCATION_CLEANUP_MINUTES=60

BREVO_API_KEY=<segredo>
EMAIL_FROM=<remetente-verificado>
EMAIL_FROM_NAME=Elite Barbearia 081
```

Em produção na Railway:

```env
TRUST_PROXY=1
```

Frontend em desenvolvimento:

```env
VITE_API_URL=http://localhost:3000/api
```

Em produção na Vercel:

```env
VITE_API_URL=/api
```

Mais detalhes: [docs/CONFIGURATION.md](docs/CONFIGURATION.md).

## Testes e qualidade

A estratégia do projeto prioriza testes focados durante alterações e validação completa em marcos importantes.

```powershell
npm.cmd test --prefix backend
npm.cmd test --prefix frontend
npm.cmd run build --prefix frontend
npm.cmd run lint -- --max-warnings=0
npm.cmd run format:check
npm.cmd run migrate:status --prefix backend
```

Também é obrigatório revisar:

```powershell
git diff --check
git status --short
```

Os testes de integração que alteram dados devem usar exclusivamente o banco isolado:

```text
barbearia_agendamento_test
```

Nunca devem utilizar o banco de desenvolvimento ou produção.

## Segurança operacional

Não devem ser versionados ou publicados:

- `.env` reais;
- senhas;
- hashes de senha;
- JWTs;
- API keys;
- credenciais de banco;
- dumps com dados reais;
- tokens de recuperação;
- logs contendo segredos.

## Deploy

### Frontend

- Vercel;
- Root Directory: `frontend`;
- build Vite;
- `VITE_API_URL=/api`;
- rewrite `/api/*` antes do fallback SPA.

### Backend

- Railway;
- Root Directory: `backend`;
- build via Dockerfile;
- API pública na porta fornecida pelo ambiente;
- MySQL acessado pela rede privada da Railway.

Endpoints operacionais:

```text
GET /api/health
GET /api/ready
```

`health` confirma que o processo está respondendo. `ready` confirma também as pré-condições necessárias de banco, schema e configuração.

## Documentação

- [Arquitetura](docs/ARCHITECTURE.md)
- [Banco de dados](docs/DATABASE.md)
- [API](docs/API.md)
- [Autenticação](docs/AUTHENTICATION.md)
- [Segurança](docs/SECURITY.md)
- [Agendamento](docs/SCHEDULING.md)
- [Planos](docs/PLANS.md)
- [Comissões](docs/COMMISSIONS.md)
- [Configuração](docs/CONFIGURATION.md)
- [Deploy](docs/DEPLOY.md)
- [Operações](docs/OPERATIONS.md)
- [Backup e restauração](docs/BACKUP-RESTORE.md)
- [Testes](docs/TESTING.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Proteção de dados](docs/DATA-PROTECTION.md)
- [Roadmap](docs/ROADMAP.md)
- [Portfólio](docs/PORTFOLIO.md)

Histórico de marcos: [CHANGELOG.md](CHANGELOG.md).

## Direitos autorais

Este projeto é software proprietário disponibilizado publicamente para demonstração técnica, portfólio e avaliação. A publicação do código-fonte não concede licença open source nem autorização geral para reutilização, modificação, redistribuição ou exploração comercial.

Consulte [LICENSE](LICENSE) e [NOTICE.md](NOTICE.md).

## Roadmap

A versão atual atende uma única barbearia. Uma evolução futura para multi-barbearia/SaaS exigirá isolamento por tenant, vínculo entre usuários e estabelecimentos, papéis por barbearia, administração da plataforma e testes rigorosos de isolamento.

Essa evolução deve ser desenvolvida e validada em ambiente isolado, sem alterações estruturais diretamente sobre a produção atual.
