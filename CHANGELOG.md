# Changelog

Todas as mudanças relevantes do projeto Elite Barbearia 081 são registradas neste arquivo.

O projeto ainda não utiliza versões públicas SemVer/tagueadas de forma consistente; por isso, este changelog registra os principais marcos funcionais e técnicos da versão de produção atual sem inventar números de release.

O formato segue a ideia de [Keep a Changelog](https://keepachangelog.com/), adaptada ao histórico real do projeto.

---

## [Não publicado]

### Documentação

- documentação técnica profissional consolidada em `docs/`;
- arquitetura;
- banco de dados;
- API;
- autenticação;
- segurança;
- agendamento;
- planos;
- comissões;
- deploy;
- operações;
- backup/restauração;
- testes;
- troubleshooting;
- roadmap;
- portfólio;
- configuração;
- proteção de dados.

---

## [Produção atual]

### Interface

- frontend React/Vite responsivo;
- PWA;
- áreas separadas para cliente, barbeiro e administrador;
- carregamento de rotas com indicador visual neutro;
- proteção de navegação por sessão e papel;
- fluxo de agendamento;
- área de planos;
- operação do barbeiro;
- painel administrativo.

### Autenticação

- cadastro público de cliente;
- login;
- logout;
- sessão via JWT;
- cookie `barbearia_session` HttpOnly;
- `Secure` em produção;
- `SameSite=Lax`;
- confirmação de sessão por `/api/auth/me`;
- suporte a múltiplos papéis;
- revogação;
- `auth_versao`;
- proteção CSRF;
- rate limiting.

### Recuperação de senha

- solicitação não enumerável;
- token de uso único;
- expiração;
- invalidação de sessões anteriores após redefinição;
- envio transacional pela Brevo via API HTTPS.

### Agendamentos

- catálogo dinâmico de serviços;
- profissionais e vínculos;
- funcionamento global;
- jornada individual;
- bloqueios;
- disponibilidade pública;
- horários gerados por regras do domínio;
- validação de fuso;
- criação transacional;
- proteção contra dupla reserva;
- idempotência;
- cancelamento;
- reagendamento;
- histórico;
- máquina de estados.

### Planos mensais

- criação e administração de planos;
- períodos de adesão e utilização;
- serviços e profissionais vinculados;
- limites semanais e totais;
- assinaturas;
- snapshots contratuais;
- pagamentos presenciais;
- utilização `reservado`, `consumido` e `liberado`;
- classificação automática `plano` versus `avulso`;
- histórico do domínio;
- adesão idempotente.

### Comissões

- migration e domínio de comissões;
- configuração por profissional;
- integração com atendimento e tipo de cobrança;
- área administrativa;
- preservação de integridade financeira.

### Área do barbeiro

- agenda própria;
- isolamento entre profissionais;
- alteração controlada de status;
- jornada;
- bloqueios;
- consulta operacional;
- arquivamento de atendimentos encerrados sem apagar o registro original.

### Administração

- dashboard operacional;
- gestão de agendamentos;
- serviços;
- profissionais;
- vínculos;
- funcionamento;
- jornadas;
- bloqueios;
- configurações;
- planos;
- assinaturas;
- pagamentos;
- usos;
- comissões.

### Banco de dados

- migrations `001` a `018`;
- MySQL;
- SQL parametrizado;
- constraints e índices;
- snapshots;
- múltiplos papéis;
- estruturas de revogação;
- idempotência;
- planos;
- comissões;
- arquivo operacional do barbeiro.

### Segurança

- Helmet;
- CORS;
- rate limiting;
- CSRF;
- cookie seguro;
- bcrypt;
- JWT;
- autorização no backend;
- validação de propriedade;
- erros sanitizados;
- segredos por ambiente;
- banco de testes protegido;
- `health` e `ready`.

### Infraestrutura

- frontend publicado na Vercel;
- backend publicado na Railway;
- MySQL na Railway;
- proxy same-origin `/api`;
- e-mail pela Brevo HTTPS;
- health/readiness para operação.

---

## Marcos técnicos relevantes

### Segurança de autenticação

A evolução de autenticação adicionou:

```text
auth_versao
tokens_jwt_revogados
cookie HttpOnly
CSRF
múltiplos papéis
```

### Concorrência de agenda

A criação de agendamento passou a revalidar disponibilidade em transação e serializar operações concorrentes do mesmo profissional.

### Idempotência

Operações críticas de criação usam chave de idempotência para evitar efeitos duplicados após retries de rede.

### Planos

A migration `016_create_monthly_plans.sql` introduziu o domínio de planos mensais, assinaturas, pagamentos, utilizações, histórico e snapshots.

### Comissões

A migration `017_create_barber_commissions.sql` adicionou o domínio financeiro relacionado aos atendimentos dos profissionais.

### Arquivamento

A migration `018_create_barber_appointment_archives.sql` adicionou arquivamento operacional da área do barbeiro sem remover dados históricos.

---

## Política para próximas entradas

Quando houver mudança relevante, registrar em uma das categorias:

```text
Added
Changed
Fixed
Security
Deprecated
Removed
```

Evitar registrar:

- formatação sem impacto;
- tentativa que não foi publicada;
- dados pessoais;
- segredos;
- detalhes temporários de debugging.
