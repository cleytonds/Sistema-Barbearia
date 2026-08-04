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

## Arquitetura inicial

O navegador acessa a SPA React, que futuramente consumirá `/api` com Axios. A API aplica cabeçalhos seguros, CORS e parsing limitado antes de encaminhar requisições às rotas. Erros passam por um middleware único. O pool MySQL é compartilhado e usa conexões assíncronas; repositories e regras de negócio serão introduzidos quando houver domínio persistido.

## Screenshots

Adicionar imagens após a implementação das páginas públicas e dos painéis.
