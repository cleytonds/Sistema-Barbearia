# Banco de dados

Infraestrutura compatível com MySQL 8.0.16+ e MariaDB 10.4+. Instantes são gravados em UTC (`DATETIME(6)`); horários recorrentes usam `TIME` local de `America/Recife`.

## Preparação

O runner não cria nem apaga bancos. Um usuário autorizado deve revisar e executar `bootstrap.sql` apenas se o banco ainda não existir. Depois, copie `backend/.env.example` para `backend/.env` e informe credenciais com acesso ao banco.

```powershell
Copy-Item backend/.env.example backend/.env
npm.cmd run migrate --prefix backend
npm.cmd run migrate:status --prefix backend
npm.cmd run seed --prefix backend
```

Cada migration possui checksum. Normalmente há um único DDL; quando uma evolução inseparável exige mais de um, os comandos são separados pelo marcador `-- statement-breakpoint` e executados em ordem. Migrations aplicadas ficam em `schema_migrations`, não são repetidas e não devem ser editadas. O runner usa `GET_LOCK` para impedir duas execuções simultâneas e encerra imediatamente na primeira falha.

MySQL realiza commit implícito para DDL. Em MySQL 8, cada `CREATE TABLE` usado aqui é atômico, mas existe uma pequena janela entre o DDL e o registro em `schema_migrations`. Se o processo for encerrado exatamente nessa janela, não altere o schema manualmente: inspecione a tabela criada e repare o registro de controle conscientemente antes de repetir.

## Integração em banco isolado

Os testes de integração escrevem no banco. Nunca os execute com o `.env` de desenvolvimento.

Crie previamente o banco `barbearia_agendamento_test` e configure credenciais exclusivas por variáveis de ambiente. O arquivo local `backend/.env.test` contém somente o nome seguro do banco e não deve receber credenciais. A configuração aborta qualquer processo com `NODE_ENV=test` cujo `DB_NAME` não termine em `_test`.

Em um cliente MySQL autorizado, crie somente o schema isolado:

```sql
CREATE DATABASE barbearia_agendamento_test
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

No PowerShell, defina as credenciais somente na sessão e aplique as migrations no banco de teste:

```powershell
$env:DB_USER='usuario_de_testes'
$env:DB_PASSWORD='senha_do_banco_de_testes'
node --env-file=backend/.env.test backend/src/database/migrate.js up
npm.cmd run test:integration --prefix backend
Remove-Item Env:DB_PASSWORD
```

O comando de migration e a integração devem ser executados somente após confirmar que `DB_NAME` é `barbearia_agendamento_test`.

## Seed

O seed é idempotente e não sobrescreve registros existentes. Os horários de 09:00 às 18:00, intervalo de 12:00 às 13:00, preços e durações são provisórios e precisam ser confirmados antes da produção. Domingo começa inativo.

## Primeiro administrador

Não há senha padrão. No PowerShell, atribua as variáveis apenas à sessão atual e execute:

```powershell
$env:ADMIN_NAME='Nome do administrador'
$env:ADMIN_EMAIL='admin@exemplo.com'
$env:ADMIN_PHONE='81999999999'
$env:ADMIN_PASSWORD='defina-uma-senha-segura'
npm.cmd run admin:create --prefix backend
Remove-Item Env:ADMIN_PASSWORD
```

A senha e o hash nunca são exibidos. Remova também as demais variáveis da sessão quando terminar.
