# Banco de Dados — Elite Barbearia 081

## 1. Visão geral

O sistema utiliza MySQL com acesso através de `mysql2/promise`. O banco é tratado como parte central das garantias de integridade, mas as regras de negócio também são validadas no backend.

Princípios:

- SQL parametrizado;
- chaves estrangeiras;
- índices para consultas operacionais;
- `DECIMAL` para dinheiro;
- `BIGINT` para identificadores de domínio quando aplicável;
- preservação de histórico;
- desativação lógica para entidades operacionais sensíveis;
- transações para operações compostas;
- locks explícitos em fluxos concorrentes;
- migrations versionadas com checksum.

## 2. Política de migrations

As migrations ficam em:

```text
backend/src/database/migrations/
```

O runner reconhece arquivos numerados no padrão:

```text
NNN_nome_da_migration.sql
```

Comandos:

```powershell
npm.cmd run migrate:status --prefix backend
npm.cmd run migrate --prefix backend
```

O runner:

1. obtém lock exclusivo de migration no MySQL;
2. garante a tabela `schema_migrations`;
3. lê as migrations em ordem;
4. calcula SHA-256 do conteúdo;
5. ignora migrations já aplicadas com checksum igual;
6. falha se uma migration aplicada tiver sido alterada;
7. registra a migration somente após sua execução.

### Regra obrigatória

**Nunca editar uma migration já aplicada em um ambiente compartilhado ou de produção.**

## 3. Migrations atuais

| Nº | Migration | Objetivo principal |
|---:|---|---|
| 001 | `001_create_usuarios.sql` | usuários e identidade base |
| 002 | `002_create_barbeiros.sql` | perfil profissional |
| 003 | `003_create_servicos.sql` | catálogo de serviços |
| 004 | `004_create_barbeiro_servicos.sql` | vínculo profissional-serviço |
| 005 | `005_create_horarios_funcionamento.sql` | funcionamento semanal global |
| 006 | `006_create_horarios_trabalho.sql` | jornada individual |
| 007 | `007_create_bloqueios_agenda.sql` | bloqueios globais/individuais |
| 008 | `008_create_agendamentos.sql` | agendamentos |
| 009 | `009_create_historico_agendamentos.sql` | auditoria/histórico do agendamento |
| 010 | `010_create_tokens_recuperacao_senha.sql` | recuperação de senha |
| 011 | `011_create_configuracoes.sql` | configuração da barbearia |
| 012 | `012_add_auth_security.sql` | reforços de autenticação/revogação |
| 013 | `013_add_unique_servicos_nome.sql` | unicidade de serviço |
| 014 | `014_add_agendamento_snapshots_and_idempotency.sql` | snapshots e idempotência |
| 015 | `015_add_multi_role_support.sql` | múltiplos papéis por usuário |
| 016 | `016_create_monthly_plans.sql` | planos, assinaturas, pagamentos, usos e snapshots |
| 017 | `017_create_barber_commissions.sql` | domínio de comissões de barbeiro |
| 018 | `018_create_barber_appointment_archives.sql` | arquivamento operacional de agendamentos do barbeiro |

## 4. Mapa lógico principal

```text
usuarios
  |
  +-- usuario_papeis -- papeis
  |
  +-- barbeiros
        |
        +-- barbeiro_servicos -- servicos
        |
        +-- horarios_trabalho
        |
        +-- bloqueios_agenda
        |
        +-- agendamentos
                |
                +-- historico_agendamentos
                |
                +-- usos_planos

horarios_funcionamento
configuracoes

tokens_recuperacao_senha
[estrutura de revogação/autenticação]
```

## 5. Identidade e autorização

### `usuarios`

Entidade central de identidade.

Responsabilidades típicas:

- nome;
- e-mail normalizado;
- telefone normalizado;
- hash de senha;
- estado ativo/inativo;
- perfil principal legado/compatível;
- versão de autenticação;
- timestamps.

Senhas nunca são persistidas em texto puro.

### `papeis`

Catálogo dos papéis reconhecidos pelo sistema:

```text
cliente
barbeiro
admin
```

### `usuario_papeis`

Relação muitos-para-muitos entre usuário e papel.

A tabela permite que uma mesma pessoa possua mais de um papel sem duplicar a identidade do usuário.

O campo de perfil principal existente em `usuarios` é mantido por compatibilidade; a autorização moderna deve considerar a relação de papéis.

## 6. Profissionais e serviços

### `barbeiros`

Complementa um usuário com informações profissionais. O estado profissional pode ser desativado sem apagar o usuário ou histórico.

### `servicos`

Catálogo dinâmico de serviços.

Características:

- nome único;
- descrição;
- preço;
- duração;
- ativo/inativo.

Serviços inativos deixam de aparecer publicamente, mas registros históricos não são reescritos.

### `barbeiro_servicos`

Tabela de associação que define quais serviços cada profissional executa.

Essa relação é usada tanto na exibição pública quanto na validação do agendamento.

## 7. Funcionamento e jornada

### `horarios_funcionamento`

Define a semana global da barbearia.

Os horários recorrentes usam tipo `TIME`, representando horário civil local.

### `horarios_trabalho`

Define a jornada semanal de cada profissional, respeitando o funcionamento global.

### `bloqueios_agenda`

Representa indisponibilidades pontuais:

- globais;
- específicas de um barbeiro.

São consideradas na disponibilidade e na validação transacional da reserva.

## 8. Agendamentos

### `agendamentos`

É uma das tabelas centrais do domínio.

Mantém, entre outros conceitos:

- cliente;
- barbeiro;
- serviço;
- ator que criou;
- origem;
- início e fim;
- fim de ocupação técnica;
- preço snapshot;
- duração snapshot;
- buffer snapshot;
- status;
- informações de idempotência;
- cobertura do plano quando aplicável.

### Snapshots

Preço, duração e outros atributos relevantes são persistidos no momento da reserva. Uma alteração posterior no serviço não deve alterar retroativamente um agendamento já criado.

### Idempotência

A criação usa hashes de chave/payload para proteger replays e cliques duplicados.

### Concorrência

A linha do barbeiro é usada como mutex lógico em operações de agenda. Fluxos de escrita críticos devem respeitar a mesma ordem de locks.

## 9. `historico_agendamentos`

Registra eventos do ciclo de vida do agendamento, como:

- criação;
- confirmação;
- mudança de status;
- reagendamento;
- cancelamento;
- conclusão/ausência quando aplicável.

O histórico é gravado na mesma transação da mudança principal sempre que necessário.

## 10. Configuração

### `configuracoes`

Na versão single-tenant atual, a configuração principal é singleton, identificada pelo registro de configuração da instalação.

Inclui conceitos como:

- nome da barbearia;
- telefone/endereço quando configurados;
- fuso horário;
- antecedência máxima;
- prazo mínimo de cancelamento;
- intervalo/buffer operacional.

O fuso inicial da produção é `America/Recife`.

## 11. Recuperação e segurança de autenticação

### `tokens_recuperacao_senha`

Armazena referência segura ao token de recuperação, com expiração e uso controlado. O token recebido pelo usuário não deve ser persistido em texto puro quando o fluxo utiliza hash.

### Revogação e versão de autenticação

A migration de segurança adiciona mecanismos para invalidar sessões/tokens anteriores, inclusive em logout ou mudança de credenciais/papéis.

## 12. Planos mensais

A migration 016 adiciona nove tabelas de domínio.

```text
planos
  +-- plano_servicos
  +-- plano_barbeiros
  |
  +-- assinaturas_planos
        +-- assinatura_plano_servicos
        +-- assinatura_plano_barbeiros
        +-- pagamentos_planos
        +-- usos_planos
        +-- historico_planos
```

### `planos`

Define a oferta comercial:

- nome/descrição;
- preço `DECIMAL`;
- período de adesão;
- período de utilização;
- limites semanal/total;
- status ativo;
- adesões abertas/fechadas;
- estado de uso permitido/suspenso.

### `plano_servicos` e `plano_barbeiros`

Definem os serviços e profissionais cobertos por novas adesões ao plano.

### `assinaturas_planos`

Representa o contrato do cliente com snapshots das condições comerciais.

Estados incluem, conforme o domínio:

```text
aguardando_pagamento
ativa
suspensa
vencida
cancelada
```

### Tabelas de snapshot

`assinatura_plano_servicos` e `assinatura_plano_barbeiros` impedem que uma edição futura do plano altere retroativamente a cobertura já contratada.

### `pagamentos_planos`

O modelo atual trabalha com pagamento presencial confirmado administrativamente. Não há renovação automática nem cobrança recorrente automática.

### `usos_planos`

Cada utilização está vinculada a um agendamento e passa por estados como:

```text
reservado
consumido
liberado
```

Há proteção contra uso duplicado do mesmo agendamento e contagem de cotas por período.

### `historico_planos`

Audita eventos relacionados a plano, assinatura, pagamento e uso sem recalcular snapshots históricos.

## 13. Comissões

A migration 017 adiciona a estrutura de comissões e configuração de comissão por barbeiro. O domínio é separado do valor contratual do plano e do agendamento.

Princípios:

- percentuais/configurações são dados administrativos;
- cálculos devem usar valores monetários seguros;
- dados históricos não devem ser recalculados silenciosamente após mudança de configuração;
- barbeiros devem acessar somente informações próprias permitidas;
- administração possui visão autorizada de configuração e registros.

Os contratos HTTP e regras detalhadas estão em [COMMISSIONS.md](COMMISSIONS.md).

## 14. Arquivo operacional do barbeiro

A migration 018 adiciona estrutura para arquivamento de agendamentos na visão do barbeiro.

O arquivamento é uma organização operacional da interface profissional e não deve representar exclusão física do agendamento ou do histórico de domínio.

## 15. Datas e timezone

Política:

```text
Instantes concretos -> UTC -> DATETIME(6)
Horários recorrentes -> TIME local
Fuso de negócio -> configuracoes.fuso_horario
```

O backend faz conversão explícita entre o horário civil da barbearia e UTC.

## 16. Dinheiro

Valores monetários são persistidos em `DECIMAL`. A aplicação evita usar ponto flutuante como fonte de verdade financeira.

Em contratos de API, valores financeiros devem ser tratados de forma previsível, preferencialmente como strings decimais quando necessário para preservar precisão.

## 17. Identificadores

IDs `BIGINT` podem ultrapassar a faixa inteira segura do JavaScript. Por isso, a camada HTTP deve serializá-los como strings quando aplicável.

## 18. FKs e exclusão

Diretrizes:

- histórico e agendamentos não devem ser apagados fisicamente no fluxo normal;
- usuário, barbeiro e serviço usam preferencialmente desativação lógica;
- FKs históricas usam políticas que impedem perda acidental de domínio;
- tabelas puramente associativas podem usar regras de exclusão compatíveis com sua natureza estrutural.

## 19. Banco de desenvolvimento, teste e produção

Os ambientes devem ser separados.

```text
Desenvolvimento: barbearia_agendamento
Teste:           barbearia_agendamento_test
Produção:        banco gerenciado pela Railway
```

Testes de integração nunca devem apontar para desenvolvimento ou produção.

O projeto possui proteção fail-closed para reduzir risco de execução de testes destrutivos no banco errado.

## 20. Backup antes de mudanças críticas

Antes de migrations futuras, migração de dados ou mudanças estruturais em produção:

1. confirmar ambiente;
2. gerar backup consistente;
3. validar que o backup é legível;
4. registrar versão/commit da aplicação;
5. aplicar a mudança controlada;
6. validar `migrate:status`;
7. validar `/api/health` e `/api/ready`;
8. realizar smoke test dos fluxos principais.

Consulte [BACKUP-RESTORE.md](BACKUP-RESTORE.md) e [OPERATIONS.md](OPERATIONS.md) para os procedimentos completos.
