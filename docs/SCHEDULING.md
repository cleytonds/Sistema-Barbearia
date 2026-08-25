# Agendamento e Disponibilidade — Elite Barbearia 081

## 1. Objetivo

Este documento explica como o sistema determina horários disponíveis e cria, cancela, reage e atualiza agendamentos de forma consistente.

Princípio principal:

> disponibilidade exibida não é reserva garantida.

A confirmação real ocorre somente quando o backend revalida tudo dentro de uma transação.

## 2. Entidades envolvidas

```text
usuarios
barbeiros
servicos
barbeiro_servicos
horarios_funcionamento
horarios_trabalho
bloqueios_agenda
configuracoes
agendamentos
historico_agendamentos
```

Com planos, também participam `assinaturas_planos`, `pagamentos_planos` e `usos_planos`.

## 3. Fluxo no frontend

```text
SchedulePage
   ↓
serviço
   ↓
profissional
   ↓
data
   ↓
GET /api/disponibilidade
   ↓
horário
   ↓
resumo
   ↓
POST /api/agendamentos
```

O frontend não define preço oficial, duração, buffer, cobertura do plano ou status arbitrário.

## 4. Disponibilidade pública

```http
GET /api/disponibilidade?barbeiroId=...&servicoId=...&data=YYYY-MM-DD
```

Valida barbeiro, serviço, vínculo, funcionamento, jornada, bloqueios, agendamentos, antecedência e limite futuro configurado.

## 5. Grade de horários

O domínio gera candidatos em passos de 15 minutos:

```text
09:00
09:15
09:30
09:45
10:00
...
```

A duração do serviço pode ser diferente do intervalo dos slots.

## 6. Intervalos semiabertos

Períodos são avaliados como `[início, fim)`.

```text
09:00–09:40
09:40–10:20
```

não conflitam apenas por encostarem na borda.

## 7. Funcionamento e jornada

A disponibilidade usa a interseção entre horário global e jornada individual. Depois remove pausas, bloqueios globais, bloqueios do profissional e períodos ocupados.

## 8. Fuso horário

Instantes concretos são tratados em UTC internamente; horários recorrentes permanecem em horário civil local.

Fuso operacional:

```text
America/Recife
```

Fluxo:

```text
data escolhida + TIME
   ↓
America/Recife
   ↓
conversão explícita
   ↓
UTC
```

## 9. Buffer técnico

Um agendamento possui `inicio_em`, `fim_em` e `fim_ocupacao_em`. O conflito considera a ocupação técnica, não apenas a duração comercial.

## 10. Status que ocupam agenda

Estados ativos incluem:

```text
pendente
confirmado
em_atendimento
```

Estados encerrados deixam de representar ocupação futura:

```text
concluido
cancelado
ausente
```

## 11. Criação pelo cliente

```http
POST /api/agendamentos
```

Usa autenticação de cliente e `Idempotency-Key`.

Payload conceitual:

```json
{
  "barbeiroId": "159",
  "servicoId": "1",
  "data": "2026-09-05",
  "horaInicio": "10:00",
  "observacoes": "Opcional"
}
```

O backend deriva cliente, preço, duração, buffer, origem, status e tipo de cobrança.

## 12. Transação de criação

```text
obter conexão
  ↓
READ COMMITTED
  ↓
begin
  ↓
lock do barbeiro
  ↓
validar entidades/vínculo
  ↓
validar horário/jornada
  ↓
validar bloqueios
  ↓
revalidar conflitos
  ↓
decidir plano ou avulso
  ↓
validar/reservar cota
  ↓
criar agendamento
  ↓
criar histórico
  ↓
commit
```

Qualquer falha provoca rollback.

## 13. Mutex lógico da agenda

O lock do barbeiro serializa escritas que afetam a agenda do mesmo profissional:

```text
Transação A → lock
Transação B → aguarda
Transação A → grava/commit
Transação B → revalida
```

## 14. Idempotência

A chave de idempotência evita duplicação após clique repetido ou falha de rede.

```text
mesma chave + mesmo payload → replay seguro
mesma chave + payload diferente → conflito
```

## 15. Snapshots

O agendamento preserva preço, duração, buffer, horários e demais dados históricos relevantes. Alterações futuras no serviço não reescrevem atendimentos antigos.

## 16. Listagem do cliente

```http
GET /api/agendamentos/meus
```

Filtros podem incluir `page`, `limit`, `status`, `periodo`, `data`, `sort` e `order`. O backend restringe ao cliente autenticado.

## 17. Área do barbeiro

Rotas principais:

```text
GET /api/barbeiro/agendamentos
GET /api/barbeiro/agendamentos/:id
PUT /api/barbeiro/agendamentos/:id/status
```

Um barbeiro não pode acessar a agenda privada de outro. Alteração de status não permite trocar preço, serviço ou horário.

## 18. Área administrativa

```text
GET  /api/admin/agendamentos
GET  /api/admin/agendamentos/:id
POST /api/admin/agendamentos
PUT  /api/admin/agendamentos/:id/status
PUT  /api/admin/agendamentos/:id/cancelar
PUT  /api/admin/agendamentos/:id/reagendar
```

A criação administrativa também é idempotente.

## 19. Cancelamento

Cliente:

```http
PUT /api/agendamentos/:id/cancelar
```

Admin:

```http
PUT /api/admin/agendamentos/:id/cancelar
```

O backend valida propriedade/permissão, status, prazo, regras temporais, efeitos no plano e histórico. Cancelamento não apaga o agendamento.

## 20. Efeito no plano

Quando existe uso reservado:

```text
cancelamento regular elegível → reservado → liberado
atendimento concluído        → reservado → consumido
```

A regra tardia diferencia responsabilidade da barbearia e do cliente.

## 21. Reagendamento

```text
lock
  ↓
validar agendamento
  ↓
validar novo horário
  ↓
revalidar disponibilidade
  ↓
revalidar cobertura
  ↓
manter / mover / liberar uso
  ↓
atualizar agendamento
  ↓
histórico
  ↓
commit
```

Se perder cobertura, o backend pode converter o atendimento para avulso conforme a regra do domínio.

## 22. Máquina de estados

Estados principais:

```text
pendente
confirmado
em_atendimento
concluido
cancelado
ausente
```

Transições inválidas são rejeitadas.

## 23. Histórico

`historico_agendamentos` preserva os eventos. Atualização e histórico pertencem à mesma operação transacional quando representam um único efeito de domínio.

## 24. Bloqueios

Podem ser globais ou específicos de um profissional. Bloqueios globais são operação administrativa; barbeiros operam apenas o próprio escopo permitido.

## 25. Disponibilidade vazia

Dia fechado ou barbeiro sem jornada pode retornar lista vazia com sucesso, pois isso é ausência válida de horários, não erro técnico.

## 26. Cache

A disponibilidade é sensível ao tempo e usa comportamento equivalente a `Cache-Control: no-store`.

## 27. Regra de ouro

Nunca criar agendamento confiando apenas no resultado previamente exibido por `/disponibilidade`. A API deve revalidar dentro da transação de criação.
