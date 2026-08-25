# Planos Mensais — Elite Barbearia 081

## 1. Objetivo

O módulo de planos mensais oferece um benefício comercial sem bloquear o atendimento normal da barbearia.

Regra central:

> quem possui cobertura válida utiliza o plano; quem não possui cobertura continua podendo agendar como avulso.

O cliente não escolhe manualmente "usar plano". A classificação é decidida pelo backend.

## 2. Entidades

```text
planos
plano_servicos
plano_barbeiros
assinaturas_planos
assinatura_plano_servicos
assinatura_plano_barbeiros
pagamentos_planos
usos_planos
historico_planos
```

## 3. Plano

Um plano define nome, descrição, preço, períodos de adesão/utilização, limites opcionais, serviços, profissionais, estado ativo, adesões abertas/fechadas e uso permitido/suspenso.

Planos não devem ser apagados fisicamente apenas para limpar dados históricos.

## 4. Vínculos

`plano_servicos` define serviços comerciais incluídos. `plano_barbeiros` define profissionais incluídos.

A cobertura usa IDs e vínculos reais do banco.

## 5. Assinatura

A assinatura representa o contrato de um cliente com um plano.

Status principais:

```text
aguardando_pagamento
ativa
suspensa
cancelada
vencida
```

## 6. Snapshots da assinatura

Uma assinatura preserva nome do plano, valor contratado, limites, fuso, serviços e profissionais vigentes no momento do contrato.

As tabelas `assinatura_plano_servicos` e `assinatura_plano_barbeiros` evitam que uma edição posterior do plano reescreva contratos existentes.

## 7. Pagamento

O pagamento do plano é presencial e confirmado pelo administrador.

Não existe renovação automática.

A tabela `pagamentos_planos` preserva competência, período coberto, valor, status e dados de confirmação/cancelamento.

## 8. Cliente com pagamento pendente

Pagamento pendente não bloqueia a agenda:

```text
assinatura existe
+
pagamento do período não confirmado
=
agendamento permitido como AVULSO
```

## 9. Uso da cota

Tabela:

```text
usos_planos
```

Estados:

```text
reservado
consumido
liberado
```

`reservado` compromete a cota; `consumido` confirma que o benefício foi usado; `liberado` devolve a cota quando a regra permite.

## 10. Decisão automática de cobertura

O backend verifica:

1. assinatura aplicável;
2. estado da assinatura;
3. pagamento confirmado;
4. data no período;
5. serviço incluído;
6. profissional incluído;
7. uso do plano permitido;
8. limite semanal;
9. limite total.

Resultado:

```text
todas as regras atendidas → PLANO
regra não atendida         → AVULSO
```

## 11. Frontend não decide cobertura

O backend não deve confiar em um payload arbitrário como:

```json
{
  "tipoCobranca": "plano"
}
```

A classificação é derivada no servidor.

## 12. Fluxo de agendamento com plano

```text
cliente agenda
   ↓
lock do barbeiro
   ↓
validar disponibilidade
   ↓
localizar/validar assinatura
   ↓
validar pagamento
   ↓
validar serviço/profissional
   ↓
validar cotas
   ↓
criar agendamento
   ↓
criar uso RESERVADO
   ↓
histórico
   ↓
commit
```

## 13. Concorrência de cota

Duas requisições simultâneas não podem consumir a última cota duas vezes. A validação e a criação do uso pertencem ao mesmo contexto transacional e utilizam locks apropriados.

## 14. Uso único por agendamento

Um agendamento não deve gerar múltiplas utilizações. A integridade é reforçada por unicidade na relação de uso.

## 15. Cancelamento

### Regular

```text
reservado → liberado
```

### Responsabilidade da barbearia

A cota pode ser liberada conforme regra do domínio.

### Cancelamento tardio do cliente

A política atual pode consumir a cota para evitar abuso de reserva.

## 16. Reagendamento

Se continuar coberto, o sistema mantém a mesma utilização e atualiza a referência temporal necessária.

Se perder cobertura:

```text
libera uso anterior
+
agendamento passa a AVULSO
```

O frontend não toma essa decisão sozinho.

## 17. Edição de plano

```text
plano atual → condições para novas assinaturas
snapshot    → condições da assinatura já contratada
```

Alterações não devem afetar retroativamente o contrato já persistido.

## 18. Desativação e adesões

Desativar plano, fechar adesões e suspender uso são operações distintas. Nenhuma delas deve apagar histórico.

## 19. Rotas públicas

```text
GET /api/planos
GET /api/planos/:id
```

## 20. Rotas do cliente

```text
POST /api/planos/:id/solicitacoes
GET  /api/meu-plano
GET  /api/meu-plano/usos
```

A solicitação de adesão é idempotente e o cliente consulta somente os próprios dados.

## 21. Rotas administrativas

Planos:

```text
GET   /api/admin/planos
POST  /api/admin/planos
GET   /api/admin/planos/:id
PUT   /api/admin/planos/:id
PATCH /api/admin/planos/:id/status
PATCH /api/admin/planos/:id/adesoes
PATCH /api/admin/planos/:id/uso
GET   /api/admin/planos/:id/assinantes
```

Assinaturas:

```text
GET /api/admin/assinaturas-planos
POST /api/admin/assinaturas-planos
GET /api/admin/assinaturas-planos/:id
PUT /api/admin/assinaturas-planos/:id/confirmar-pagamento
PUT /api/admin/assinaturas-planos/:id/suspender
PUT /api/admin/assinaturas-planos/:id/reativar
PUT /api/admin/assinaturas-planos/:id/cancelar
GET /api/admin/assinaturas-planos/:id/usos
GET /api/admin/assinaturas-planos/:id/historico
```

## 22. Idempotência de adesão

```text
mesma chave + mesmo payload → mesma assinatura
mesma chave + payload diferente → 409
```

## 23. Histórico

`historico_planos` registra eventos de plano, assinatura, pagamento e uso sem incluir dados sensíveis.

## 24. Dinheiro

Valores são armazenados em `DECIMAL`. Snapshots financeiros não são recalculados com o preço atual.

## 25. Privacidade do barbeiro

O profissional pode precisar saber se o atendimento é `plano` ou `avulso`, mas não precisa receber valor mensal, histórico de pagamentos ou informações financeiras administrativas desnecessárias.

## 26. Exemplo completo

```text
Assinatura ativa
   ↓
Pagamento confirmado
   ↓
Data válida
   ↓
Serviço incluído
   ↓
Barbeiro incluído
   ↓
Cota disponível
   ↓
Agendamento = PLANO
   ↓
Uso = RESERVADO
   ↓
Atendimento concluído
   ↓
Uso = CONSUMIDO
```

Se uma regra falhar, o agendamento continua possível como `AVULSO`.

## 27. Regra de ouro

O plano é um benefício, não uma barreira de atendimento.
