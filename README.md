# Sistema de Agendamento para Barbearia

Aplicação full stack para gestão de agendamentos de uma barbearia. A Fase 1 estabelece o monorepo, a API Express, a conexão MySQL e a aplicação React responsiva.

## Tecnologias

- Frontend: React, Vite, React Router DOM, Axios e CSS responsivo.
- Backend: Node.js, Express ES Modules, mysql2/promise, Helmet, CORS e dotenv.
- Banco: MySQL ou MariaDB (schema e migrations serão criados na Fase 2).

## Estrutura

```text
backend/
  src/config/         ambiente e banco
  src/middlewares/    tratamento HTTP
  src/routes/         rotas da API
  src/utils/          utilitários compartilhados
  test/               testes automatizados
frontend/
  src/styles/         estilos globais
  src/App.jsx         rotas iniciais
  src/main.jsx        bootstrap React
```

As pastas `controllers`, `services`, `repositories`, `validators`, `database/migrations`, além de contexts, layouts e páginas específicas do frontend, serão adicionadas nas fases correspondentes para evitar estruturas vazias.

## Requisitos

- Node.js 22 ou superior
- npm 10 ou superior
- MySQL 8+ ou MariaDB 10.6+

## Instalação

No Windows PowerShell, use o executável `npm.cmd` para evitar bloqueios do wrapper `npm.ps1` pela política de execução:

```powershell
npm.cmd install
npm.cmd install --prefix backend
npm.cmd install --prefix frontend
```

Crie os arquivos locais de ambiente no PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Configure ao menos as credenciais `DB_*`. Não versione arquivos `.env`.

## Execução

```powershell
# frontend e backend juntos
npm.cmd run dev

# ou separadamente
npm.cmd run dev --prefix backend
npm.cmd run dev --prefix frontend
```

- Frontend: http://localhost:5173
- API: http://localhost:3000/api
- Saúde: http://localhost:3000/api/health

Durante a Fase 1 a API continua disponível mesmo se o banco ainda não tiver sido criado, exibindo um aviso no terminal. Operações futuras de dados exigirão a conexão.

## Qualidade

```powershell
npm.cmd test
npm.cmd run build
```

## Segurança de dependências

O frontend utiliza React Router DOM 7.18.2, versão estável mais recente publicada no npm durante esta revisão. O audit aponta o advisory `GHSA-qwww-vcr4-c8h2`, restrito oficialmente às APIs RSC instáveis; esta SPA opera em modo declarativo com `BrowserRouter` e não utiliza RSC. A correção existe em `react-router` 8.3.0, mas a versão correspondente de `react-router-dom` ainda não está publicada no npm. O risco residual deve ser acompanhado, e a atualização será feita quando houver uma versão DOM corrigida e instalável, sem `npm audit fix --force` automático.

## Variáveis de ambiente

Consulte os arquivos `.env.example`. O `JWT_SECRET` será obrigatório quando a autenticação for implementada na Fase 3. Credenciais de e-mail também poderão permanecer vazias no desenvolvimento local.

## Roadmap

- Fase 1: estrutura inicial (atual)
- Fase 2: schema, migrations, índices e seed
- Fase 3: autenticação e autorização
- Fases seguintes: catálogo, disponibilidade, agendamentos e painéis por perfil

## Banco de dados

As migrations, seed e criação segura do primeiro administrador estão documentados em `backend/src/database/README.md`. O runner nunca cria ou apaga automaticamente o banco configurado.

## Autenticação

A API possui cadastro de clientes, login, consulta da sessão, logout com revogação, alteração e recuperação de senha. JWTs usam HS256, expiração curta, `issuer`, `audience`, versão de autenticação e `jti`. O middleware sempre consulta o usuário ativo no banco.

Antes de iniciar a API, configure um `JWT_SECRET` aleatório com no mínimo 32 caracteres e use `JWT_EXPIRES_IN=15m`. Não reutilize o placeholder do `.env.example` e nunca versione o `.env`.

## Cadastros operacionais

Nomes de serviços são normalizados (`trim` e espaços consecutivos) antes da validação de unicidade. URLs de foto aceitam apenas HTTPS; `http://localhost` é permitido somente em desenvolvimento. Uma evolução futura poderá marcar a senha inicial do barbeiro como temporária e exigir troca no primeiro login; essa flag não faz parte da versão atual.

## Disponibilidade da agenda

A consulta pública usa somente `GET /api/disponibilidade`, com `barbeiroId`, `servicoId` e
`data` civil no formato `YYYY-MM-DD`:

```text
Cliente
  ↓
disponibilidadeValidator
  ↓
disponibilidadeController
  ↓
disponibilidadeService
  ↓
disponibilidadeRepository
  ↓
domain/availability
  ↓
buildDailyAvailability
  ↓
generateCandidateSlots
  ↓
filterUnavailableSlots
  ↓
Resposta no horário local
```

Os instantes são convertidos para UTC internamente, mas a resposta pública contém somente o
horário local do fuso configurado para a barbearia. Os candidatos começam em uma grade fixa de
15 minutos e exigem antecedência mínima de 30 minutos. A duração exibida é a duração real do
serviço; o intervalo técnico é acrescentado apenas ao período interno usado para conflitos.

A consulta é informativa e não reserva um horário. A futura criação ou alteração de um
agendamento deverá iniciar uma transação `READ COMMITTED`, bloquear a linha do barbeiro e
repetir todas as validações antes da escrita. O teste de contenção atual comprova somente que
validações transacionais do mesmo barbeiro são serializadas; a garantia contra dupla inserção
pertence à Fase 6. Não existe reserva temporária de slot nesta versão.

O buffer atual vem de `configuracoes.intervalo_entre_atendimentos_minutos`. Agendamentos
existentes ainda não preservam o buffer vigente quando foram criados, portanto mudar a
configuração pode alterar a interpretação histórica da ocupação. Antes da Fase 6 deverá ser
reavaliada uma futura coluna `buffer_minutos`, criada por nova migration sem modificar as já
aplicadas.

A rota possui rate limit próprio de 60 requisições por minuto por IP e responde com
`Cache-Control: no-store`. O contador em memória atende somente uma instância; implantação
horizontal deverá usar Redis ou armazenamento compartilhado equivalente.

## Arquitetura inicial

O navegador acessa a SPA React, que futuramente consumirá `/api` com Axios. A API aplica cabeçalhos seguros, CORS e parsing limitado antes de encaminhar requisições às rotas. Erros passam por um middleware único. O pool MySQL é compartilhado e usa conexões assíncronas; repositories e regras de negócio serão introduzidos quando houver domínio persistido.

## Resiliência e observabilidade

A API aceita `X-Request-Id` com até 64 caracteres ASCII seguros. Valores ausentes ou inválidos
são substituídos por UUID, e o identificador efetivo sempre retorna no header da resposta. Ele
correlaciona logs durante a requisição, mas ainda não é persistido no histórico. Uma migration
futura específica poderá adicionar correlation ID sem modificar migrations aplicadas.

Logs operacionais usam estrutura com allowlist e podem conter request ID, IDs técnicos, operação,
código do erro, tentativa e duração. Senhas, hashes de senha, JWTs, tokens de recuperação,
Idempotency-Key original, bodies completos, observações, e-mail, telefone e credenciais do banco
nunca são registrados. Em produção, a saída é JSON.

Criação idempotente, cancelamento, reagendamento e mudança de status admitem retry apenas para
`ER_LOCK_DEADLOCK` e `ER_LOCK_WAIT_TIMEOUT`. São no máximo três tentativas, com atraso curto e
limitado. Cada tentativa usa nova conexão e nova transação; a tentativa anterior sempre sofre
rollback e libera sua conexão. Ao esgotar o limite, o erro final é preservado.

Erros de validação, autorização, disponibilidade, idempotência, estado, entidades ausentes,
constraints e `ER_DUP_ENTRY` comum não são repetidos. O conflito do índice único de idempotência
mantém seu fluxo próprio de rollback, nova leitura e comparação do payload. A mesma chave e os
mesmos hashes são preservados durante retries transitórios; idempotência e retry de lock são
mecanismos distintos. O backend é a autoridade para limites e validações desses contratos.

## Screenshots

Adicionar imagens após a implementação das páginas públicas e dos painéis.
