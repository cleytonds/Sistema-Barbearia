# Roadmap — Elite Barbearia 081

## 1. Objetivo

Este documento registra evoluções futuras sem misturá-las com a versão de produção atual.

A versão atual deve permanecer estável antes de qualquer mudança estrutural.

---

## 2. Estado atual

Arquitetura:

```text
single-tenant
```

Atende a Elite Barbearia 081.

Funcionalidades centrais:

- autenticação;
- cliente;
- barbeiro;
- admin;
- disponibilidade;
- agendamento;
- planos;
- comissões;
- PWA;
- produção Vercel/Railway.

---

## 3. Prioridade imediata

Antes de novas features:

```text
estabilidade
backup
monitoramento
documentação
testes reais de operação
```

---

## 4. Melhorias operacionais

Possíveis evoluções:

- rotina automática de backup;
- observabilidade estruturada;
- alertas de indisponibilidade;
- métricas de erro;
- domínio próprio;
- página de status interna;
- procedimento formal de incidentes.

---

## 5. Melhorias de produto

Possíveis:

- notificações adicionais;
- confirmação automática de lembretes;
- relatórios administrativos;
- filtros e exportações;
- melhorias de acessibilidade;
- analytics respeitando privacidade.

Devem ser avaliadas por valor real ao negócio.

---

## 6. Escalabilidade

Se o backend passar a operar com múltiplas instâncias:

- rate limit precisa store compartilhado;
- jobs precisam coordenação;
- caches precisam estratégia;
- locks de aplicação não podem depender de memória local.

O MySQL continua sendo autoridade transacional dos domínios críticos.

---

## 7. Multi-barbearia / SaaS

Não pertence à versão atual.

Para suportar múltiplas barbearias com isolamento real, a arquitetura precisa introduzir conceito de tenant.

Entidade central futura:

```text
barbearias
```

---

## 8. Tenant scoping

Tabelas operacionais receberiam vínculo com a barbearia, direta ou indiretamente:

```text
servicos
barbeiros
horarios
bloqueios
agendamentos
planos
assinaturas
comissoes
configuracoes
```

Toda consulta precisa aplicar o escopo correto.

---

## 9. Usuários multi-barbearia

Evitar simplesmente adicionar:

```text
usuarios.barbearia_id
```

se uma pessoa puder participar de mais de uma barbearia.

Modelo melhor:

```text
usuarios
   |
usuario_barbearias
   |
barbearias
```

Papéis também precisam ser associados ao contexto da barbearia.

---

## 10. Papéis futuros

Possível estrutura:

```text
usuario
+
barbearia
+
papel
```

Exemplo:

```text
Cleyton -> Loja A -> admin
Cleyton -> Loja B -> suporte
```

---

## 11. Super administração

Uma plataforma SaaS pode precisar de:

```text
super_admin
```

Esse papel deve ficar separado dos administradores de cada barbearia.

Um admin de tenant jamais deve acessar outro tenant.

---

## 12. Migração

Nunca transformar produção single-tenant em multi-tenant com uma única mudança gigante.

Estratégia:

```text
1. branch isolada
2. banco staging
3. adicionar tenant
4. backfill
5. constraints
6. scoping de repositories
7. testes de isolamento
8. frontend
9. migração operacional
10. rollout controlado
```

---

## 13. Testes de isolamento

Antes de SaaS:

```text
tenant A não lê B
tenant A não altera B
IDs previsíveis não furam isolamento
admin A não acessa B
barbeiro A não acessa B
```

Esses testes são obrigatórios.

---

## 14. Infraestrutura SaaS

Só depois do isolamento lógico:

- domínio/subdomínio por barbearia;
- branding;
- billing;
- onboarding;
- observabilidade por tenant;
- limites/planos da plataforma.

---

## 15. Regra de roadmap

Não implementar uma evolução apenas porque "seria legal".

Cada mudança deve responder:

```text
qual problema real resolve?
qual risco adiciona?
qual custo operacional?
qual impacto no lançamento atual?
```
