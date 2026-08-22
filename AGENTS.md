# Guia permanente do projeto

## Identidade

- Sistema profissional de agendamento para barbearia.
- Frontend: React 19, Vite, React Router e Axios.
- Backend: Node.js, ES Modules e Express.
- Banco: MySQL 8 com `mysql2/promise`.
- Autenticação: JWT e bcrypt.
- Papéis: `cliente`, `barbeiro` e `admin`; um usuário pode ter múltiplos papéis.
- O projeto evolui gradualmente para uma futura arquitetura multi-barbearia/SaaS.

## Comandos principais (Windows PowerShell)

```powershell
# Frontend e backend juntos
npm.cmd run dev

# Separadamente
npm.cmd run dev --prefix backend
npm.cmd run dev --prefix frontend

# Qualidade
npm.cmd test --prefix backend
npm.cmd test --prefix frontend
npm.cmd run build --prefix frontend
npm.cmd run lint -- --max-warnings=0
npm.cmd run format
npm.cmd run format:check
npm.cmd run migrate:status --prefix backend
```

## Git

- Sempre executar `git status --short` antes de editar e preservar alterações existentes.
- Não usar `git add .` nem `git add -A`; fazer staging explícito dos caminhos revisados.
- Não fazer commit ou push sem autorização explícita.
- Não reescrever histórico sem autorização.
- Revisar o staging e executar `git diff --check` antes de qualquer commit.
- Não incluir arquivos pessoais, temporários ou fora do escopo autorizado.

## Migrations

- O estado atual contém migrations `001`–`017`; todas estão aplicadas localmente.
- A migration 017 pertence à Fase 11 em andamento e pode ainda não estar commitada.
- Nunca editar uma migration aplicada sem autorização explícita; preservar checksums.
- Nova estrutura usa a próxima migration numerada e o runner existente.
- Não apagar, recriar ou fazer backfill de dados reais sem autorização.

## Dados reais

- Preservar Cadu, Jonatas, demais usuários reais, serviços, vínculos, jornadas, agendamentos, planos, assinaturas e pagamentos.
- Não inventar e-mail, telefone, senha, preço, duração, percentual ou jornada.
- Fixtures devem usar prefixos únicos e dados artificiais claramente identificados.
- Cleanup deve funcionar inclusive após falha, preferencialmente em `finally`/hooks adequados.
- Nunca deixar `@example.test`, marcadores ou relações de teste no banco.

## Arquitetura

Fluxo padrão: `Controller → Service → Repository → DB`.

- Controller: contrato HTTP, sem regra de negócio.
- Service: regras, autorização de domínio e coordenação transacional.
- Repository: SQL e persistência, sem decidir regra de negócio.
- Domain: regras puras e determinísticas quando aplicável.
- Reutilizar services, adapters e helpers existentes antes de criar abstrações novas.

## Transações e concorrência

- Usar o padrão transacional e `transactionContext` existentes.
- Usar a mesma connection durante toda a operação e rollback em qualquer falha.
- Gravar histórico e efeitos relacionados na mesma transação.
- Respeitar a ordem de locks já definida pelo fluxo.
- Repository não inicia `beginTransaction`, `commit` ou `rollback`.
- Operações críticas devem ser idempotentes e não continuar após erro transacional.

## Dinheiro, IDs e SQL

- Persistir dinheiro em `DECIMAL`; transportar valores financeiros como string.
- Não usar float para persistência ou cálculos financeiros.
- Preservar `BIGINT` como string na API quando aplicável.
- Usar SQL parametrizado; nunca interpolar entrada do usuário.
- Snapshots históricos não são recalculados com valores atuais.

## Autorização e áreas

- Cliente acessa somente seus próprios dados.
- Barbeiro acessa somente sua área operacional e seus dados permitidos.
- Admin gerencia a área administrativa.
- Jonatas pode ter múltiplos papéis; nunca escolher destino ou permissão por `roles[0]`.
- Navegação deve respeitar a área atual (`/admin`, `/barbeiro` ou área comum).
- O frontend não é fonte de verdade para autorização; o backend sempre valida.

## Planos mensais

- Pagamento é presencial e confirmado por admin; não há renovação automática.
- O backend decide `plano` versus `avulso`; o frontend nunca força `tipo_cobranca`.
- Cliente sem cobertura/pagamento válido ainda pode agendar como avulso.
- Uso de plano passa por `reservado`, `consumido` ou `liberado`.
- Cancelamento por responsabilidade da barbearia libera a cota.
- Cancelamento tardio por responsabilidade do cliente consome a cota.
- Preservar snapshots de plano, serviço, preço e demais dados históricos.

## Serviços

- Serviços são dinâmicos e vêm do banco/API; não fazer hardcode de nomes.
- Novo serviço ativo aparece nas opções de planos e, com vínculo, no agendamento.
- Vínculos com profissionais vêm do banco.
- Serviço não incluído no plano permanece atendimento avulso.
- Inativação não deve apagar nem quebrar históricos e snapshots.

## Frontend

- A API atual prefere camelCase; normalização fica centralizada em services/adapters.
- Páginas tratam `loading`, erro, vazio, `null`, listas ausentes e datas inválidas.
- Dados opcionais ou inválidos nunca devem derrubar a árvore React.
- Não fixar dados reais da barbearia ou profissionais no JSX quando existe API.
- Preservar acessibilidade, foco, teclado, `aria-live` e responsividade.

## Testes e validação

- Durante implementação, executar primeiro apenas testes focados e afetados.
- Não rodar suíte completa ou comandos caros após cada alteração pequena.
- Rodar suíte completa quando necessário e no fechamento de fase.
- Antes de commit: backend e frontend completos, build, lint sem warnings, format/check,
  `git diff --check`, `migrate:status`, checksums e auditoria de resíduos.
- Testes frontend usam mocks determinísticos e não chamam APIs externas reais.
- Não declarar teste manual de navegador concluído sem navegador real.

## Segurança

- Nunca versionar `.env`, senhas, `senha_hash`, JWTs, tokens, segredos ou credenciais.
- Nunca incluir `node_modules`, `dist`, `.history`, anexos pessoais, screenshots ou logs temporários.
- Não registrar segredos em logs ou respostas.
- Manter validação, sanitização, rate limit, Helmet, CORS e erros centralizados.
- Não usar correções forçadas de dependências que possam quebrar o projeto.

## Economia de contexto e escopo

- Ler este arquivo antes de trabalhar e usá-lo como contexto permanente.
- Não reauditar o projeto inteiro sem necessidade; ler apenas arquivos relacionados.
- Não repetir arquitetura já documentada, salvo quando uma decisão mudar.
- Preservar trabalho pendente e não ampliar o escopo autorizado.
- Preferir respostas finais curtas, factuais e baseadas em resultados reais.
- Não executar comandos caros desnecessariamente.
- Parar assim que o escopo autorizado estiver concluído.
