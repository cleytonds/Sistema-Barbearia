# API — Elite Barbearia 081

## 1. Convenções gerais

Base da API:

```text
/api
```

Em desenvolvimento, por padrão, o backend pode ser acessado diretamente na porta local configurada. Em produção, o frontend usa `/api` e a Vercel encaminha as requisições para a Railway.

Formato predominante de resposta:

```json
{
  "data": {}
}
```

Listagens podem incluir metadados de paginação.

## 2. Autenticação

A autenticação utiliza cookie HttpOnly. O frontend deve enviar credenciais nas requisições (`withCredentials`).

Operações mutáveis protegidas também respeitam a política de CSRF/Origin definida pelo backend.

### Rotas

| Método | Rota | Acesso | Finalidade |
|---|---|---|---|
| POST | `/api/auth/cadastro` | Público | cadastrar cliente |
| POST | `/api/auth/login` | Público | autenticar por e-mail/senha |
| POST | `/api/auth/logout` | Autenticado | revogar sessão atual e limpar cookie |
| GET | `/api/auth/me` | Sessão | validar sessão e retornar usuário atual |
| PUT | `/api/auth/alterar-senha` | Autenticado | alterar senha e invalidar sessões anteriores conforme regra |
| POST | `/api/auth/esqueci-senha` | Público | iniciar recuperação sem enumerar usuário |
| POST | `/api/auth/redefinir-senha` | Público com token | consumir token e definir nova senha |

### Resposta pública de recuperação

A resposta de `/esqueci-senha` deve permanecer genérica, independentemente de o e-mail existir ou de o provedor de e-mail falhar. Isso evita enumeração de contas.

## 3. Serviços públicos

| Método | Rota | Acesso | Observação |
|---|---|---|---|
| GET | `/api/servicos` | Público | lista somente serviços públicos/ativos |
| GET | `/api/servicos/:id` | Público | detalhe de serviço ativo |

Filtros podem incluir paginação, busca e ordenação por campos permitidos.

Um serviço inativo não deve ser revelado como “existente, porém inativo” para o público.

## 4. Barbeiros públicos

| Método | Rota | Acesso | Finalidade |
|---|---|---|---|
| GET | `/api/barbeiros` | Público | listar profissionais ativos |
| GET | `/api/barbeiros/:id` | Público | detalhe público do profissional |
| GET | `/api/barbeiros/:id/servicos` | Público | serviços ativos vinculados |

Dados pessoais internos, credenciais e estado administrativo não fazem parte do contrato público.

## 5. Disponibilidade

```http
GET /api/disponibilidade?barbeiroId=2&servicoId=4&data=2026-08-15
```

Acesso: público.

Parâmetros principais:

- `barbeiroId`: ID positivo;
- `servicoId`: ID positivo;
- `data`: `YYYY-MM-DD`.

A rota considera:

- configuração da barbearia;
- funcionamento;
- jornada;
- pausas;
- bloqueios;
- agendamentos ativos;
- antecedência mínima/máxima;
- duração e ocupação técnica.

**Importante:** um horário exibido não é uma reserva. A disponibilidade é revalidada na criação transacional.

## 6. Agendamentos do cliente

Todas as rotas pessoais exigem sessão válida e papel/identidade compatíveis.

| Método | Rota | Finalidade |
|---|---|---|
| POST | `/api/agendamentos` | criar agendamento idempotente |
| GET | `/api/agendamentos/meus` | listar somente agendamentos do cliente autenticado |
| GET | `/api/agendamentos/:id` | detalhe próprio |
| PUT | `/api/agendamentos/:id/cancelar` | cancelar dentro das regras |
| PUT | `/api/agendamentos/:id/reagendar` | alterar data/hora permitidas |

### Criação

Exemplo conceitual:

```json
{
  "barbeiroId": "2",
  "servicoId": "4",
  "data": "2026-08-15",
  "horaInicio": "10:00",
  "observacoes": "Opcional"
}
```

Header obrigatório nas criações idempotentes:

```http
Idempotency-Key: <chave-unica>
```

O cliente não escolhe diretamente:

- `cliente_id`;
- preço final persistido;
- duração snapshot;
- buffer;
- status arbitrário;
- origem interna;
- `tipo_cobranca`.

Esses dados são derivados pelo backend.

## 7. Área do barbeiro

Rotas protegidas e sempre restritas ao profissional da sessão.

| Método | Rota | Finalidade |
|---|---|---|
| GET | `/api/barbeiro/dashboard` | indicadores operacionais próprios |
| GET | `/api/barbeiro/agendamentos` | listar agenda própria |
| GET | `/api/barbeiro/agendamentos/:id` | detalhe de agendamento vinculado |
| PUT | `/api/barbeiro/agendamentos/:id/status` | executar transição permitida |

A área profissional também possui contratos para jornada, bloqueios e perfil conforme a implementação operacional.

### Privacidade

O barbeiro:

- não consulta agenda de outro profissional;
- não altera dados administrativos de terceiros;
- recebe somente os dados de cliente necessários ao atendimento;
- não recebe credenciais ou informações financeiras de planos fora da necessidade operacional.

## 8. Administração — agendamentos

Todas as rotas desta seção exigem sessão + papel `admin`.

| Método | Rota | Finalidade |
|---|---|---|
| GET | `/api/admin/dashboard` | dashboard operacional |
| GET | `/api/admin/agendamentos` | listagem paginada e filtrável |
| GET | `/api/admin/agendamentos/:id` | detalhe administrativo |
| POST | `/api/admin/agendamentos` | criação manual idempotente |
| PUT | `/api/admin/agendamentos/:id/status` | transição de status |
| PUT | `/api/admin/agendamentos/:id/cancelar` | cancelamento administrativo |
| PUT | `/api/admin/agendamentos/:id/reagendar` | reagendamento administrativo |

A criação administrativa recebe o cliente explicitamente, mas preço, duração, buffer e demais snapshots continuam sendo derivados pelo backend.

## 9. Administração — serviços

| Método | Rota | Finalidade |
|---|---|---|
| GET | `/api/admin/servicos` | listar ativos/inativos |
| POST | `/api/admin/servicos` | criar serviço |
| GET | `/api/admin/servicos/:id` | detalhe |
| PUT | `/api/admin/servicos/:id` | editar campos permitidos |
| PATCH | `/api/admin/servicos/:id/status` | ativar/desativar |

Não há necessidade de apagar fisicamente um serviço que possua histórico.

## 10. Administração — profissionais

| Método | Rota | Finalidade |
|---|---|---|
| GET | `/api/admin/barbeiros` | listar profissionais |
| POST | `/api/admin/barbeiros` | criar usuário + perfil profissional |
| GET | `/api/admin/barbeiros/:id` | detalhe administrativo |
| PUT | `/api/admin/barbeiros/:id` | editar profissional |
| PATCH | `/api/admin/barbeiros/:id/status` | ativar/desativar |
| GET | `/api/admin/barbeiros/:id/servicos` | listar vínculos |
| PUT | `/api/admin/barbeiros/:id/servicos` | sincronizar vínculos |
| GET | `/api/admin/barbeiros/:id/horarios` | consultar jornada |
| PUT | `/api/admin/barbeiros/:id/horarios` | atualizar jornada semanal |

Criações/alterações compostas são transacionais quando necessário.

## 11. Administração — funcionamento, bloqueios e configuração

| Método | Rota | Finalidade |
|---|---|---|
| GET | `/api/admin/horarios-funcionamento` | consultar semana global |
| PUT | `/api/admin/horarios-funcionamento` | substituir/atualizar semana global |
| GET | `/api/admin/bloqueios` | listar bloqueios |
| POST | `/api/admin/bloqueios` | criar bloqueio global ou específico |
| DELETE | `/api/admin/bloqueios/:id` | remover bloqueio conforme contrato atual |
| GET | `/api/admin/configuracoes` | configuração administrativa |
| PUT | `/api/admin/configuracoes` | atualizar singleton de configuração |

Mudanças em funcionamento e jornada podem afetar disponibilidade futura e devem ser tratadas como operações administrativas sensíveis.

## 12. Planos públicos

| Método | Rota | Acesso | Finalidade |
|---|---|---|---|
| GET | `/api/planos` | Público | listar planos comercialmente visíveis |
| GET | `/api/planos/:id` | Público | detalhe público do plano |

A API pública expõe somente os dados necessários à decisão comercial do cliente.

## 13. Planos — cliente

| Método | Rota | Finalidade |
|---|---|---|
| POST | `/api/planos/:id/solicitacoes` | solicitar adesão idempotente |
| GET | `/api/meu-plano` | obter assinatura atual/pertinente |
| GET | `/api/meu-plano/usos` | consultar utilizações |

O backend valida sobreposição de assinatura, períodos, elegibilidade, status do plano e demais regras.

## 14. Planos — administração

### Planos

| Método | Rota | Finalidade |
|---|---|---|
| GET | `/api/admin/planos` | listar planos |
| POST | `/api/admin/planos` | criar plano |
| GET | `/api/admin/planos/:id` | detalhe |
| PUT | `/api/admin/planos/:id` | editar condições permitidas |
| PATCH | `/api/admin/planos/:id/status` | ativar/desativar |
| PATCH | `/api/admin/planos/:id/adesoes` | abrir/fechar adesões |
| PATCH | `/api/admin/planos/:id/uso` | permitir/suspender utilização |
| GET | `/api/admin/planos/:id/assinantes` | listar assinantes |

### Assinaturas

| Método | Rota | Finalidade |
|---|---|---|
| GET | `/api/admin/assinaturas-planos` | listar assinaturas |
| POST | `/api/admin/assinaturas-planos` | criar adesão administrativa |
| GET | `/api/admin/assinaturas-planos/:id` | detalhe |
| PUT | `/api/admin/assinaturas-planos/:id/confirmar-pagamento` | confirmar pagamento presencial |
| PUT | `/api/admin/assinaturas-planos/:id/suspender` | suspender assinatura |
| PUT | `/api/admin/assinaturas-planos/:id/reativar` | reativar |
| PUT | `/api/admin/assinaturas-planos/:id/cancelar` | cancelar |
| GET | `/api/admin/assinaturas-planos/:id/usos` | utilizações |
| GET | `/api/admin/assinaturas-planos/:id/historico` | histórico |

### Regras centrais

- pagamento atual é presencial;
- não existe renovação automática;
- assinatura possui snapshots;
- o cliente sem cobertura pode continuar como avulso;
- o frontend não pode forçar cobertura de plano;
- alterações de plano não reescrevem contratos históricos.

## 15. Comissões e arquivo do barbeiro

O backend possui módulos adicionados pelas migrations 017 e 018 para:

- configuração/cálculo/consulta de comissões de barbeiro;
- arquivamento operacional de agendamentos na área profissional.

Os contratos detalhados dessas áreas serão mantidos nos documentos dedicados `COMMISSIONS.md` e `OPERATIONS.md`, evitando duplicar regras financeiras e operacionais neste inventário geral.

## 16. Health e readiness

| Método | Rota | Acesso | Finalidade |
|---|---|---|---|
| GET | `/api/health` | Público/infra | processo HTTP vivo |
| GET | `/api/ready` | Público/infra | banco/schema/configuração prontos |

`ready` deve falhar de forma segura quando pré-condições essenciais de produção não forem atendidas.

## 17. Paginação

Listagens operacionais seguem padrão com conceitos como:

```text
page
limit
sort
order
```

Valores de `sort` devem ser escolhidos por allowlist; nomes de coluna vindos do usuário não são interpolados livremente em SQL.

## 18. Códigos HTTP

| Código | Uso principal |
|---:|---|
| 200 | consulta/alteração bem-sucedida ou replay idempotente |
| 201 | recurso criado |
| 204 | operação sem corpo de resposta |
| 400/422 | entrada inválida/regra de negócio |
| 401 | autenticação ausente/inválida/expirada/revogada |
| 403 | autenticado, porém sem permissão |
| 404 | recurso inexistente ou inacessível |
| 409 | conflito, concorrência, duplicidade ou idempotência |
| 429 | rate limit |
| 500 | erro interno sanitizado |

## 19. Erros de domínio relevantes

Exemplos de códigos internos usados/esperados pelo domínio de agendamentos:

```text
APPOINTMENT_NOT_FOUND
APPOINTMENT_FORBIDDEN
AVAILABILITY_CHANGED
INVALID_STATUS_TRANSITION
CANCELLATION_DEADLINE_PASSED
RESCHEDULE_DEADLINE_PASSED
APPOINTMENT_ALREADY_CANCELLED
APPOINTMENT_ALREADY_COMPLETED
IDEMPOTENCY_KEY_REQUIRED
IDEMPOTENCY_KEY_CONFLICT
CLIENT_NOT_FOUND
BARBER_NOT_FOUND
SERVICE_NOT_FOUND
BUSINESS_RULE_VIOLATION
```

Conflitos de disponibilidade não devem revelar dados do agendamento conflitante.

## 20. Privacidade das respostas

A API nunca deve responder com:

- `senha_hash`;
- senha em texto;
- JWT bruto fora do mecanismo autorizado de sessão;
- token de recuperação;
- API keys;
- credenciais de banco;
- stack trace de produção.

Dados de cliente são minimizados conforme o papel do solicitante.

## 21. Exemplo de fluxo completo

```text
GET /api/servicos
GET /api/barbeiros
GET /api/disponibilidade
POST /api/auth/login
GET /api/auth/me
POST /api/agendamentos + Idempotency-Key
GET /api/agendamentos/meus
```

A criação final não confia na disponibilidade consultada anteriormente: o backend revalida tudo dentro de transação.
